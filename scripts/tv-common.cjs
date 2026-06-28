const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const projectRoot = path.resolve(__dirname, '..')
const workspaceRoot = path.resolve(projectRoot, '..')
const androidDir = path.join(projectRoot, 'android')
const sdkRoot = path.join(workspaceRoot, 'android-sdk')
const adbPath = path.join(sdkRoot, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb')
const noxAdbPath = process.platform === 'win32' ? 'D:\\Program Files\\Nox\\bin\\nox_adb.exe' : ''
const apkBuildType = process.env.TV_APK_BUILD_TYPE || 'release'
const packageJson = require(path.join(projectRoot, 'package.json'))
const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', apkBuildType, `${packageJson.name}-v${packageJson.version}-universal.apk`)
const appActivity = 'cn.toside.music.mobile/.MainActivity'
const defaultAdbSerial = process.env.TV_ADB_SERIAL || '127.0.0.1:62001'

const jdkCandidates = [
  'F:\\zywZY\\JDK17\\jdk-17.0.19+10',
  process.env.JAVA_HOME,
  'C:\\Program Files\\Android\\Android Studio\\jbr',
].filter(Boolean)

const resolveJdkHome = () => {
  return jdkCandidates.find(candidate => {
    return fs.existsSync(path.join(candidate, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'))
  }) ?? null
}

const getGradleEnv = () => {
  const env = { ...process.env }
  const nodeDir = path.dirname(process.execPath)
  const javaHome = resolveJdkHome()
  env.PATH = `${nodeDir}${path.delimiter}${env.PATH ?? ''}`
  if (javaHome) {
    env.JAVA_HOME = javaHome
    env.PATH = `${path.join(javaHome, 'bin')}${path.delimiter}${env.PATH ?? ''}`
  }
  return env
}

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: options.cwd ?? projectRoot,
    env: options.env ?? process.env,
    shell: options.shell ?? false,
  })

  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const runGradle = (tasks) => {
  const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew'
  const command = process.platform === 'win32'
    ? `"${path.join(androidDir, gradlew)}" ${tasks.join(' ')}`
    : path.join(androidDir, gradlew)

  run(
    process.platform === 'win32' ? command : command,
    process.platform === 'win32' ? [] : tasks,
    {
      cwd: androidDir,
      env: getGradleEnv(),
      shell: process.platform === 'win32',
    },
  )
}

const resolveAdb = () => {
  if (process.env.TV_ADB_PATH && fs.existsSync(process.env.TV_ADB_PATH)) return process.env.TV_ADB_PATH
  if (fs.existsSync(noxAdbPath)) return noxAdbPath
  if (fs.existsSync(adbPath)) return adbPath
  return process.platform === 'win32' ? 'adb.exe' : 'adb'
}

const getAdbArgs = (args) => {
  return defaultAdbSerial
    ? ['-s', defaultAdbSerial, ...args]
    : args
}

const runAdb = (args, options = {}) => {
  run(resolveAdb(), getAdbArgs(args), options)
}

const captureAdbRaw = (args) => {
  const result = spawnSync(resolveAdb(), args, {
    cwd: projectRoot,
    env: process.env,
    encoding: 'utf8',
  })
  if (result.error) throw result.error
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

const listDevices = () => {
  const output = captureAdbRaw(['devices']).stdout
  const devices = output
    .split(/\r?\n/)
    .slice(1)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.split(/\s+/))
    .filter(parts => parts[1] === 'device')
    .map(parts => parts[0])

  return devices
}

const connectDefaultDevice = () => {
  if (!defaultAdbSerial.includes(':')) return
  captureAdbRaw(['connect', defaultAdbSerial])
}

const ensureDeviceConnected = () => {
  let devices = listDevices()
  if (!devices.includes(defaultAdbSerial)) {
    connectDefaultDevice()
    devices = listDevices()
  }
  if (!devices.length) {
    console.error(`No Android TV device detected. Tried ${defaultAdbSerial}.`)
    process.exit(1)
  }
  return devices
}

module.exports = {
  apkPath,
  appActivity,
  ensureDeviceConnected,
  listDevices,
  projectRoot,
  runAdb,
  runGradle,
}
