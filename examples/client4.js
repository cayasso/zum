const zum = require('../src/index')
let bus = zum()

!async function () {

  try {
    bus = await bus.connect()

    console.log('-----------------------------------------------------')
    console.log(' CONNECTED TO : ' + bus.host)
    console.log(' CLIENT No:   : 4 ')
    console.log(' STARTED      : ' + new Date())
    console.log('-----------------------------------------------------')

    bus.subscribe('HOLA', function (seg, msg, fn) {
      console.log('=====>', seg, msg)
      //fn(null, 'RECIBIDO GRACIAS [client 2]')
    })
  } catch(err) {
    console.log(err)
  }
}()
