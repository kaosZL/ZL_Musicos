#!/usr/bin/env node
// 跨平台零依赖单测运行器（v1.9.26）：兼容 Linux CI / macOS / Windows，不依赖 bash 或 /tmp
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outfile = join(tmpdir(), 'zl-unit-tests.cjs')
const esbuildArgs = [
  'esbuild',
  '__tests__/index.ts',
  '--bundle',
  '--platform=node',
  '--format=cjs',
  `--outfile=${outfile}`,
  '--log-level=error',
  '--alias:react-native=./__tests__/stubs/react-native.ts',
  '--alias:@/utils/nativeModules/utils=./__tests__/stubs/nativeModules.ts',
]

if (process.platform === 'win32') {
  execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npx.cmd', ...esbuildArgs], {
    cwd: rootDir,
    stdio: 'inherit',
  })
} else {
  execFileSync('npx', esbuildArgs, { cwd: rootDir, stdio: 'inherit' })
}

execFileSync(process.execPath, [outfile], { cwd: rootDir, stdio: 'inherit' })
