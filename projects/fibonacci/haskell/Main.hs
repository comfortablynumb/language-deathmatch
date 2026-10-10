{-# LANGUAGE BangPatterns #-}

-- | Fibonacci: print the first N Fibonacci numbers (mod 2^64), one per line.
module Main (main) where

import Data.ByteString.Builder (Builder, char7, hPutBuilder, word64Dec)
import Data.Char (isDigit)
import Data.Word (Word64)
import System.Environment (getArgs)
import System.Exit (ExitCode (ExitFailure), exitWith)
import System.IO

maxCount :: Integer
maxCount = 1000000000

usage :: String
usage = "usage: fibonacci N  (N: 0..1000000000)"

main :: IO ()
main = do
  args <- getArgs

  case parseCount args of
    Nothing -> hPutStrLn stderr usage >> exitWith (ExitFailure 1)
    Just n -> writeOutput (fibonacci n)

-- | Accepts exactly one argument made only of ASCII digits, at most 'maxCount'.
-- 'read' runs only on validated digits and parses into an unbounded 'Integer'.
parseCount :: [String] -> Maybe Int
parseCount [arg]
  | not (null arg) && all isDigit arg && n <= maxCount = Just (fromInteger n)
  where
    n = read arg :: Integer
parseCount _ = Nothing

-- | Runs the builder into a 64 KiB block-buffered, binary stdout.
writeOutput :: Builder -> IO ()
writeOutput builder = do
  hSetBinaryMode stdout True
  hSetBuffering stdout (BlockBuffering (Just 65536))
  hPutBuilder stdout builder
  hFlush stdout

-- | F(0)..F(count-1), one per line; 'Word64' addition wraps modulo 2^64.
fibonacci :: Int -> Builder
fibonacci = go 0 1
  where
    go :: Word64 -> Word64 -> Int -> Builder
    go !a !b !left
      | left <= 0 = mempty
      | otherwise = word64Dec a <> char7 '\n' <> go b (a + b) (left - 1)
