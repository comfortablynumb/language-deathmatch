{-# LANGUAGE BangPatterns #-}

-- | Fasta: generate three DNA sequences in FASTA format (Benchmarks Game, sequential).
module Main (main) where

import Control.Monad (void)
import Data.Array.Unboxed (UArray, listArray, (!))
import qualified Data.ByteString as B
import qualified Data.ByteString.Char8 as BC
import Data.ByteString.Builder (Builder, byteString, char7, hPutBuilder, string7)
import Data.Char (isDigit)
import Data.Maybe (fromMaybe)
import Data.Word (Word8)
import System.Environment (getArgs)
import System.Exit (ExitCode (ExitFailure), exitWith)
import System.IO

maxCount :: Integer
maxCount = 25000000

lineWidth :: Int
lineWidth = 60

usage :: String
usage = "usage: fasta N  (N: 0..25000000)"

-- Linear congruential generator: seed = (seed * ia + ic) mod im.
im, ia, ic, initialSeed :: Int
im = 139968
ia = 3877
ic = 29573
initialSeed = 42

alu :: B.ByteString
alu =
  BC.pack $
    concat
      [ "GGCCGGGCGCGGTGGCTCACGCCTGTAATCCCAGCACTTTGG",
        "GAGGCCGAGGCGGGCGGATCACCTGAGGTCAGGAGTTCGAGA",
        "CCAGCCTGGCCAACATGGTGAAACCCCGTCTCTACTAAAAAT",
        "ACAAAAATTAGCCGGGCGTGGTGGCGCGCGCCTGTAATCCCA",
        "GCTACTCGGGAGGCTGAGGCAGGAGAATCGCTTGAACCCGGG",
        "AGGCGGAGGTTGCAGTGAGCCGAGATCGCGCCACTGCACTCC",
        "AGCCTGGGCGACAGAGCGAGACTCCGTCTCAAAAA"
      ]

iub :: [(Char, Double)]
iub =
  [ ('a', 0.27), ('c', 0.12), ('g', 0.12), ('t', 0.27),
    ('B', 0.02), ('D', 0.02), ('H', 0.02), ('K', 0.02), ('M', 0.02),
    ('N', 0.02), ('R', 0.02), ('S', 0.02), ('V', 0.02), ('W', 0.02), ('Y', 0.02)
  ]

homoSapiens :: [(Char, Double)]
homoSapiens =
  [ ('a', 0.3029549426680),
    ('c', 0.1979883004921),
    ('g', 0.1975473066391),
    ('t', 0.3015094502008)
  ]

-- | Symbols with their cumulative probabilities, in table order.
data Table = Table
  { symbols :: !B.ByteString,
    cumulative :: !(UArray Int Double)
  }

main :: IO ()
main = do
  args <- getArgs

  case parseCount args of
    Nothing -> hPutStrLn stderr usage >> exitWith (ExitFailure 1)
    Just n -> setupStdout >> writeFasta n >> hFlush stdout

-- | Accepts exactly one argument made only of ASCII digits, at most 'maxCount'.
-- 'read' runs only on validated digits and parses into an unbounded 'Integer'.
parseCount :: [String] -> Maybe Int
parseCount [arg]
  | not (null arg) && all isDigit arg && n <= maxCount = Just (fromInteger n)
  where
    n = read arg :: Integer
parseCount _ = Nothing

-- | Binary, 64 KiB block-buffered stdout for 'hPutBuilder'.
setupStdout :: IO ()
setupStdout = do
  hSetBinaryMode stdout True
  hSetBuffering stdout (BlockBuffering (Just 65536))

-- | Writes the three records; one generator serves both random ones.
writeFasta :: Int -> IO ()
writeFasta n = do
  hPutBuilder stdout (string7 ">ONE Homo sapiens alu\n" <> repeatLines alu (2 * n))
  hPutBuilder stdout (string7 ">TWO IUB ambiguity codes\n")
  seed <- writeRandom (makeTable iub) (3 * n) initialSeed
  hPutBuilder stdout (string7 ">THREE Homo sapiens frequency\n")
  void (writeRandom (makeTable homoSapiens) (5 * n) seed)

-- | The running double sum of the probabilities ('scanl1' adds them in table order).
makeTable :: [(Char, Double)] -> Table
makeTable entries =
  Table
    { symbols = BC.pack (map fst entries),
      cumulative = listArray (0, length entries - 1) (scanl1 (+) (map snd entries))
    }

-- | `count` characters of `s` repeated cyclically, 'lineWidth' per line.
repeatLines :: B.ByteString -> Int -> Builder
repeatLines s = go 0
  where
    extended = s <> B.take lineWidth s -- a line starting anywhere in s never wraps
    go !pos !left
      | left <= 0 = mempty
      | otherwise =
          let count = min lineWidth left
              line = B.take count (B.drop pos extended)
           in byteString line <> char7 '\n' <> go ((pos + count) `rem` B.length s) (left - count)

-- | Writes `count` symbols picked from the table, one generator step each,
-- 'lineWidth' per line; returns the generator state for the next record.
writeRandom :: Table -> Int -> Int -> IO Int
writeRandom table = go
  where
    go !left !seed
      | left <= 0 = pure seed
      | otherwise = do
          let count = min lineWidth left
              (line, seed') = randomLine table count seed
          hPutBuilder stdout (byteString line <> char7 '\n')
          go (left - count) seed'

-- | One line of `count` random symbols and the generator state after it
-- ('B.unfoldrN' hands back the state after exactly `count` steps).
randomLine :: Table -> Int -> Int -> (B.ByteString, Int)
randomLine table count seed = (line, fromMaybe seed rest)
  where
    (line, rest) = B.unfoldrN count step seed
    step s = let s' = nextSeed s in Just (pick table (toRandom s'), s')

-- | Advances the generator; the intermediate value stays below 2^30 and is never
-- negative, so 'rem' (the machine remainder) equals 'mod'.
nextSeed :: Int -> Int
nextSeed seed = (seed * ia + ic) `rem` im

-- | The generator state as a double in [0, 1): IEEE-754 division.
toRandom :: Int -> Double
toRandom seed = fromIntegral seed / fromIntegral im

-- | The first symbol whose cumulative probability exceeds r, else the last one.
pick :: Table -> Double -> Word8
pick (Table syms cumul) r = go 0
  where
    lastIndex = B.length syms - 1
    go !i
      | i == lastIndex || r < cumul ! i = B.index syms i
      | otherwise = go (i + 1)
