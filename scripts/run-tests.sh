#!/bin/bash
# 零依赖单测运行器（v1.9.24）：esbuild 打包（替换 react-native / 原生模块为测试桩）→ node 执行
set -e
cd "$(dirname "$0")/.."

npx esbuild __tests__/index.ts \
  --bundle --platform=node --format=cjs \
  --outfile=/tmp/zl-unit-tests.cjs \
  --log-level=error \
  --alias:react-native=./__tests__/stubs/react-native.ts \
  --alias:@/utils/nativeModules/utils=./__tests__/stubs/nativeModules.ts

node /tmp/zl-unit-tests.cjs
