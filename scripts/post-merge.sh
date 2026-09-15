#!/bin/bash
set -e

npm ci
npm run codegen
node scripts/normalize-generated.mjs
