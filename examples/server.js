const zum = require('../src/index')

!async function () {
  try {
    const bus = await zum.bind()

    console.log('-----------------------------------------------------')
    console.log(' LISTENING : ' + bus.host)
    console.log(' STARTED   : ' + new Date())
    console.log('-----------------------------------------------------')

  } catch(err) {
    console.log('ERROR', err)
  }
}()
