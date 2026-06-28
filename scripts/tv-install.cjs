const fs = require('fs')
const { apkPath, ensureDeviceConnected, listDevices, runAdb, runGradle } = require('./tv-common.cjs')

const args = new Set(process.argv.slice(2))

if (args.has('--devices')) {
  const devices = listDevices()
  if (!devices.length) {
    console.log('No Android TV device detected.')
    process.exit(0)
  }
  devices.forEach(device => console.log(device))
  process.exit(0)
}

if (!fs.existsSync(apkPath) || args.has('--build')) {
  runGradle([':app:assembleRelease', '--stacktrace'])
}

ensureDeviceConnected()
runAdb(['install', '-r', apkPath])

if (args.has('--launch')) {
  runAdb(['shell', 'am', 'start', '-n', 'cn.toside.music.mobile/.MainActivity'])
}
