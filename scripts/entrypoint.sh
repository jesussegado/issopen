#!/bin/sh
set -eu

node dist/runtime/src/server/db/migrate.js
exec node dist/runtime/src/server/index.js
