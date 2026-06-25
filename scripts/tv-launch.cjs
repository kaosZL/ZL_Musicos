const { appActivity, ensureDeviceConnected, runAdb } = require('./tv-common.cjs')

ensureDeviceConnected()
runAdb(['shell', 'am', 'start', '-n', appActivity])
