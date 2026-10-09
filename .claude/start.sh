#!/bin/sh
# Production preview launcher: serves the last `next build` with the user-local Node on PATH.
export PATH="$HOME/.local/node/bin:$PATH"
exec node node_modules/next/dist/bin/next start "$@"
