const zum = require('../src/index')

const bus = zum.bind()
console.log(bus)
bus.on('error', (err) => {
  console.error(err)
})

bus.on('listening', (info) => {
  console.log('-----------------------------------------------------')
  console.log(' CONNECTED : ' + info.host)
  console.log(' STARTED   : ' + new Date())
  console.log('-----------------------------------------------------')
})
