const { ensureDeviceConnected, runAdb } = require('./tv-common.cjs')

const keyMap = {
  up: 'KEYCODE_DPAD_UP',
  down: 'KEYCODE_DPAD_DOWN',
  left: 'KEYCODE_DPAD_LEFT',
  right: 'KEYCODE_DPAD_RIGHT',
  ok: 'KEYCODE_ENTER',
  enter: 'KEYCODE_ENTER',
  select: 'KEYCODE_ENTER',
  back: 'KEYCODE_BACK',
  menu: 'KEYCODE_MENU',
  home: 'KEYCODE_HOME',
  play: 'KEYCODE_MEDIA_PLAY_PAUSE',
  pause: 'KEYCODE_MEDIA_PLAY_PAUSE',
  next: 'KEYCODE_MEDIA_NEXT',
  prev: 'KEYCODE_MEDIA_PREVIOUS',
  previous: 'KEYCODE_MEDIA_PREVIOUS',
}

const args = process.argv.slice(2).map(arg => arg.toLowerCase())

const printHelp = () => {
  console.log('Usage: npm run tv:remote -- <key> [key...]')
  console.log('')
  console.log('Keys:')
  console.log('  up down left right ok enter back menu home')
  console.log('  play pause next prev')
  console.log('')
  console.log('Examples:')
  console.log('  npm run tv:remote -- up')
  console.log('  npm run tv:remote -- right right ok')
  console.log('  npm run tv:remote -- back')
}

if (!args.length || args.includes('--help') || args.includes('-h')) {
  printHelp()
  process.exit(0)
}

const keyCodes = args.map(arg => {
  const keyCode = keyMap[arg]
  if (!keyCode) {
    console.error(`Unknown remote key: ${arg}`)
    printHelp()
    process.exit(1)
  }
  return keyCode
})

ensureDeviceConnected()

for (const keyCode of keyCodes) {
  runAdb(['shell', 'input', 'keyevent', keyCode])
}
