const zum = require('../src/index')
let bus = zum()

!async function () {
  try {
    bus = await bus.connect()

    console.log('-----------------------------------------------------')
    console.log(' CONNECTED TO : ' + bus.host)
    console.log(' CLIENT No:   : 1 ')
    console.log(' STARTED      : ' + new Date())
    console.log('-----------------------------------------------------')

    bus.on('error', (err) => {
      console.error('ERROR ====>', err);
    })

    let ids = 0
    setInterval(() => {
      const data =  { id: ids++ }
      console.log('SENDING ===>', data)
      bus.publish('HOLA', 'HOLA')
    }, 6000)

  } catch(err) {
    console.log(err)
  }

  process.on('unhandledRejection', up => {  })
}()
