{-# LANGUAGE BangPatterns #-}

-- | Primes sieve: count, sum and find the largest prime up to N (Sieve of Eratosthenes).
module Main (main) where

import Control.Monad (when)
import Control.Monad.ST (ST)
import Data.Array.ST (STUArray, newArray, readArray, runSTUArray, writeArray)
import Data.Array.Unboxed (UArray, bounds, (!))
import Data.ByteString.Builder (Builder, char7, hPutBuilder, intDec, string7, word64Dec)
import Data.Char (isDigit)
import Data.Word (Word64, Word8)
import System.Environment (getArgs)
import System.Exit (ExitCode (ExitFailure), exitWith)
import System.IO

maxLimit :: Integer
maxLimit = 200000000

usage :: String
usage = "usage: primes-sieve N  (N: 0..200000000)"

-- | Count, sum and largest prime of the scan (strict fields: no thunks build up).
data Summary = Summary !Int !Word64 !Int

main :: IO ()
main = do
  args <- getArgs

  case parseLimit args of
    Nothing -> hPutStrLn stderr usage >> exitWith (ExitFailure 1)
    Just n -> writeOutput (report (summarize (sieve n)))

-- | Accepts exactly one argument made only of ASCII digits, at most 'maxLimit'.
-- 'read' runs only on validated digits and parses into an unbounded 'Integer'.
parseLimit :: [String] -> Maybe Int
parseLimit [arg]
  | not (null arg) && all isDigit arg && n <= maxLimit = Just (fromInteger n)
  where
    n = read arg :: Integer
parseLimit _ = Nothing

-- | Runs the builder into a 64 KiB block-buffered, binary stdout.
writeOutput :: Builder -> IO ()
writeOutput builder = do
  hSetBinaryMode stdout True
  hSetBuffering stdout (BlockBuffering (Just 65536))
  hPutBuilder stdout builder
  hFlush stdout

-- | One 'Word8' flag per integer 0..n (an 'STUArray' of 'Bool' would be bit-packed);
-- 1 marks a prime once every p with p * p <= n has crossed off its multiples.
sieve :: Int -> UArray Int Word8
sieve n = runSTUArray $ do
  flags <- newArray (0, n) 1
  mapM_ (\i -> writeArray flags i 0) [0 .. min 1 n]
  let outer !p
        | p * p > n = pure ()
        | otherwise = do
            flag <- readArray flags p
            when (flag /= 0) (crossOff flags p n)
            outer (p + 1)
  outer 2
  pure flags

-- | Clears p * p, p * p + p, ... <= n.
crossOff :: STUArray s Int Word8 -> Int -> Int -> ST s ()
crossOff flags p n = go (p * p)
  where
    go !multiple
      | multiple > n = pure ()
      | otherwise = writeArray flags multiple 0 >> go (multiple + p)

-- | Scans the flags once, counting, summing and remembering the largest prime.
summarize :: UArray Int Word8 -> Summary
summarize flags = foldl' step (Summary 0 0 0) [lo .. hi]
  where
    (lo, hi) = bounds flags
    step summary@(Summary count total _) i
      | flags ! i /= 0 = Summary (count + 1) (total + fromIntegral i) i
      | otherwise = summary

-- | The three result lines.
report :: Summary -> Builder
report (Summary count total largest) =
  string7 "count: " <> intDec count <> char7 '\n'
    <> string7 "sum: " <> word64Dec total <> char7 '\n'
    <> string7 "largest: " <> intDec largest <> char7 '\n'
