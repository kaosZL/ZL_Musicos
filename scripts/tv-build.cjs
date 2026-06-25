const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { projectRoot, runGradle } = require('./tv-common.cjs')

const bundleOutput = path.join(projectRoot, 'android', 'app', 'src', 'main', 'assets', 'index.android.bundle')
const metroCli = path.join(
  projectRoot,
  'node_modules',
  'metro',
  'src',
  'cli.js',
)

const runMetroBundle = () => {
  fs.mkdirSync(path.dirname(bundleOutput), { recursive: true })
  const metroOutput = `${bundleOutput}.js`

  const result = spawnSync(process.execPath, [
    metroCli,
    'build',
    'index.js',
    '--platform',
    'android',
    '--dev',
    'false',
    '--out',
    path.relative(projectRoot, bundleOutput),
    '--reset-cache',
    '--max-workers',
    '2',
  ], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
    shell: false,
  })

  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)

  if (fs.existsSync(metroOutput)) {
    fs.rmSync(bundleOutput, { force: true })
    fs.renameSync(metroOutput, bundleOutput)
  }
}

runMetroBundle()
runGradle([':app:assembleDebug', '--stacktrace'])
