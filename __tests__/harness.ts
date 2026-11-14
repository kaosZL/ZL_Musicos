/**
 * 零依赖微型测试框架（v1.9.24）：esbuild 打包后由 node 执行，不引入 jest。
 * 用法：import { test, eq, ok, run } from './harness'
 */

const tests: Array<{ name: string, fn: () => void | Promise<void> }> = []
let passed = 0
let failed = 0

export const test = (name: string, fn: () => void | Promise<void>) => {
  tests.push({ name, fn })
}

export const eq = (actual: unknown, expected: unknown, msg = '') => {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a !== b) throw new Error(`${msg} 期望 ${b} 实际 ${a}`)
}

export const ok = (value: unknown, msg = '') => {
  if (!value) throw new Error(`期望真值: ${msg}`)
}

export const run = async() => {
  for (const t of tests) {
    try {
      await t.fn()
      passed++
      console.log('  ✓', t.name)
    } catch (err) {
      failed++
      console.error('  ✗', t.name, '\n    ', (err as Error).message)
    }
  }
  console.log(`\n${tests.length} 项：${passed} 通过，${failed} 失败`)
  if (failed > 0) process.exit(1)
}
