const crypto = require('crypto')

const ALGORITHM = 'aes-256-cbc'
const SECRET = 'secret'

function encrypt(message, secret = SECRET, algo = ALGORITHM) {
  const cipher = crypto.createCipher(algo, secret)
  return Buffer.concat([cipher.update(message), cipher.final()])
}

function decrypt(message, secret = SECRET, algo = ALGORITHM) {
  const decipher = crypto.createDecipher(algo, secret)
  return Buffer.concat([decipher.update(message), decipher.final()])
}

module.exports = {
  encrypt,
  decrypt
}
