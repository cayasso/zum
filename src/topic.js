'use strict'

module.exports = () => {
  const queue = []
  const socks = new Set()

  let n = 0
  const queueing = false

  const send = (buf, force) => {
    const sock = [...socks][n++ % socks.size]
    if (sock && sock.writable && !queueing || force && queueing) {
      sock.write(buf)
    } else {
      queue.push(['send', buf])
    }
  }

  const broadcast = (buf, force) => {
    if (socks.size && !queueing || force && queueing) {
      for (const s of socks) s && s.writable && s.write(buf)
    } else {
      queue.push(['broadcast', buf])
    }
  }

  const runners = { send, broadcast }
  const add = sock => socks.add(sock)
  const remove = sock => socks.delete(sock)

  return { ...runners, add, remove }
}
