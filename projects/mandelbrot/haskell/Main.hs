{-# LANGUAGE BangPatterns #-}

-- | Mandelbrot: render the Mandelbrot set as an N×N binary PBM (P4) bitmap.
module Main (main) where

import Data.Bits (shiftL, (.|.))
import Data.ByteString.Builder (Builder, char7, hPutBuilder, intDec, string7, word8)
import Data.Char (isDigit)
import Data.Word (Word8)
import System.Environment (getArgs)
import System.Exit (ExitCode (ExitFailure), exitWith)
import System.IO

maxSize :: Integer
maxSize = 16000

maxIterations :: Int
maxIterations = 50

limit :: Double
limit = 4.0

usage :: String
usage = "usage: mandelbrot N  (N: 1..16000)"

main :: IO ()
main = do
  args <- getArgs

  case parseSize args of
    Nothing -> hPutStrLn stderr usage >> exitWith (ExitFailure 1)
    Just n -> writeOutput (image n)

-- | Accepts exactly one argument made only of ASCII digits, in 1..'maxSize'.
-- 'read' runs only on validated digits and parses into an unbounded 'Integer'.
parseSize :: [String] -> Maybe Int
parseSize [arg]
  | not (null arg) && all isDigit arg && n >= 1 && n <= maxSize = Just (fromInteger n)
  where
    n = read arg :: Integer
parseSize _ = Nothing

-- | Runs the builder into a 64 KiB block-buffered, binary stdout.
writeOutput :: Builder -> IO ()
writeOutput builder = do
  hSetBinaryMode stdout True
  hSetBuffering stdout (BlockBuffering (Just 65536))
  hPutBuilder stdout builder
  hFlush stdout

-- | The PBM header, then the n rows of the bitmap from top to bottom.
image :: Int -> Builder
image n = header <> foldMap (row n) [0 .. n - 1]
  where
    header = string7 "P4\n" <> intDec n <> char7 ' ' <> intDec n <> char7 '\n'

-- | Row y as ceil(n / 8) bytes, 8 pixels per byte.
row :: Int -> Int -> Builder
row n y = foldMap (word8 . packByte n ci) [0, 8 .. n - 1]
  where
    ci = 2.0 * fromIntegral y / fromIntegral n - 1.0

-- | Pixels x0..x0+7 of a row, most significant bit first; pixels past the
-- right edge are zero padding. 'fromIntegral' converts Int to Double exactly.
packByte :: Int -> Double -> Int -> Word8
packByte n ci x0 = foldl' addPixel 0 [x0 .. x0 + 7]
  where
    addPixel :: Word8 -> Int -> Word8
    addPixel !byte x = (byte `shiftL` 1) .|. (if x < n && inSet (cr x) ci then 1 else 0)
    cr x = 2.0 * fromIntegral x / fromIntegral n - 1.5

-- | Iterates z = z² + c up to 'maxIterations' times; true if |z|² stayed ≤ 4.
-- tr and ti are always zr * zr and zi * zi, so the loop carries only zr and zi;
-- every operation rounds on its own (GHC never fuses into FMA) in the spec's order.
inSet :: Double -> Double -> Bool
inSet cr ci = go 0 0.0 0.0
  where
    go :: Int -> Double -> Double -> Bool
    go !i !zr !zi
      | i == maxIterations || tr + ti > limit = tr + ti <= limit
      | otherwise = go (i + 1) (tr - ti + cr) (2.0 * zr * zi + ci)
      where
        tr = zr * zr
        ti = zi * zi
