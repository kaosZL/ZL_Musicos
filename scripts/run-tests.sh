#!/bin/bash
# 保留脚本入口兼容，实际执行委托给跨平台 Node 运行器（scripts/run-tests.mjs）
set -e
exec node "$(dirname "$0")/run-tests.mjs"
