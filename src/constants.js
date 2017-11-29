'use strict'

const NODE_ENV = process.env.NODE_ENV
const REAL_HOST = 'tcp://127.0.0.1:5555'
const TEST_HOST = 'tcp://127.0.0.1:4444'

module.exports = {
  SUB: 'SUB',
  UNS: 'UNS',
  PUB: 'PUB',
  HSK: 'HSK',
  ACK: 'ACK',
  SEND: 'send',
  BROADCAST: 'broadcast',
  HOST: (NODE_ENV === 'test') ? TEST_HOST : REAL_HOST
}
