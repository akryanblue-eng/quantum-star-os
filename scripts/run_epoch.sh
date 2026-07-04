#!/usr/bin/env bash
# Machine A: execute the reference chain and write canonical artifacts.
# Usage: scripts/run_epoch.sh [outDir]
# Default outDir is the committed golden vector, so `git diff` after a
# run immediately shows any drift on this machine.
set -euo pipefail
cd "$(dirname "$0")/../systems/causal-kernel"
npx -y tsx src/harness/run_chain.ts "${1:-vectors/genesis-chain-v1}"
