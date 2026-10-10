{-# LANGUAGE BangPatterns #-}
-- Every tree must really be built: full laziness would float the loop-invariant
-- `make depth` out of the iteration loop (one tree checked many times), and CSE
-- would share the two identical `make (depth - 1)` subtrees of a node.
{-# OPTIONS_GHC -fno-full-laziness -fno-cse #-}

-- | Binary trees: allocate, walk and discard perfect binary trees (Benchmarks Game, sequential).
module Main (main) where

import Control.Exception (evaluate)
import Control.Monad (forM_)
import Data.Bits (shiftL)
import Data.ByteString.Builder (Builder, char7, hPutBuilder, intDec, string7)
import Data.Char (isDigit)
import System.Environment (getArgs)
import System.Exit (ExitCode (ExitFailure), exitWith)
import System.IO

minDepth :: Int
minDepth = 4

maxInput :: Integer
maxInput = 21

usage :: String
usage = "usage: binary-trees N  (N: 0..21)"

-- | One heap object per node; strict fields make building a node build its whole subtree.
-- A leaf is a 'Node' whose children are both 'Nil'.
data Tree = Nil | Node !Tree !Tree

main :: IO ()
main = do
  args <- getArgs

  case parseDepth args of
    Nothing -> hPutStrLn stderr usage >> exitWith (ExitFailure 1)
    Just n -> setupStdout >> run n >> hFlush stdout

-- | Accepts exactly one argument made only of ASCII digits, at most 'maxInput'.
-- 'read' runs only on validated digits and parses into an unbounded 'Integer'.
parseDepth :: [String] -> Maybe Int
parseDepth [arg]
  | not (null arg) && all isDigit arg && n <= maxInput = Just (fromInteger n)
  where
    n = read arg :: Integer
parseDepth _ = Nothing

-- | Binary, 64 KiB block-buffered stdout for 'hPutBuilder'.
setupStdout :: IO ()
setupStdout = do
  hSetBinaryMode stdout True
  hSetBuffering stdout (BlockBuffering (Just 65536))

-- | A perfect tree of the given depth, children before their parent.
make :: Int -> Tree
make 0 = Node Nil Nil
make depth = Node (make (depth - 1)) (make (depth - 1))

-- | Walks the whole tree and returns its node count.
check :: Tree -> Int
check Nil = 0
check (Node left right) = 1 + check left + check right

-- | Prints the stretch tree, one line per iteration depth and the long-lived tree.
-- 'evaluate' sequences the work: each tree is built, checked and dropped in order.
run :: Int -> IO ()
run n = do
  let maxDepth = max (minDepth + 2) n
      stretchDepth = maxDepth + 1
  stretch <- evaluate (check (make stretchDepth))
  emit [string7 "stretch tree of depth ", intDec stretchDepth, string7 "\t check: ", intDec stretch]
  longLived <- evaluate (make maxDepth)
  forM_ [minDepth, minDepth + 2 .. maxDepth] $ \depth -> do
    let iterations = 1 `shiftL` (maxDepth - depth + minDepth)
    total <- evaluate (sumChecks depth iterations)
    emit [intDec iterations, string7 "\t trees of depth ", intDec depth, string7 "\t check: ", intDec total]
  emit [string7 "long lived tree of depth ", intDec maxDepth, string7 "\t check: ", intDec (check longLived)]

-- | Builds, checks and drops `iterations` trees of `depth`, one at a time.
sumChecks :: Int -> Int -> Int
sumChecks depth = go 0
  where
    go !total 0 = total
    go !total left = go (total + check (make depth)) (left - 1)

-- | Writes the pieces as one output line.
emit :: [Builder] -> IO ()
emit pieces = hPutBuilder stdout (mconcat pieces <> char7 '\n')
