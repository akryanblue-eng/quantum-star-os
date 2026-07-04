#!/usr/bin/env bash
# Machine B: re-execute a recorded bundle on this machine and demand byte
# equality. Exit 0 iff replay is byte-identical and fully verified.
# Usage: scripts/verify_replay.sh [bundleDir]
set -euo pipefail
cd "$(dirname "$0")/../systems/causal-kernel"
npx -y tsx src/harness/verify_replay.ts "${1:-vectors/genesis-chain-v1}"
