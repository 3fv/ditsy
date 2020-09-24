#!/usr/bin/env bash

set -e

if [[ ! -e index.d.ts ]]; then
  if [[ -d lib ]]; then
    echo echo "$PWD/lib cleaned"
    rm -Rf lib
  fi
  mkdir -p lib
  cp package.json lib
  tsc -b tsconfig.json "$@"
  echo "$PWD/lib successfully built"
fi
