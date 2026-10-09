#!/bin/sh
# Local preview launcher: Turbopack spawns `node` for PostCSS, so the
# user-local Node install must be on PATH for the dev server's children.
export PATH="$HOME/.local/node/bin:$PATH"
exec node node_modules/next/dist/bin/next dev "$@"
