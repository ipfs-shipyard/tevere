'use strict'

const EventEmitter = require('events')
const diff = require('hyperdiff')

const POLLING_INTERVAL_MS = 1000

module.exports = class Room extends EventEmitter {
  constructor (topic, ipfs) {
    super()

    this._topic = topic
    this._ipfs = ipfs
    this._peers = []
    this._poller = setInterval(this._poll.bind(this), POLLING_INTERVAL_MS)
  }

  close () {
    clearInterval(this._poller)
  }

  _poll () {
    this._ipfs.pubsub.peers(this._topic, (err, _newPeers) => {
      if (err) {
        this.emit('error', err)
        return // early
      }

      const newPeers = _newPeers.sort()

      if (this._emitChanges(newPeers)) {
        this._peers = newPeers
      }
    })
  }

  _emitChanges (newPeers) {
    const differences = diff(this._peers, newPeers)

    differences.added.forEach((addedPeer) => this.emit('peer joiner', addedPeer))
    differences.removed.forEach((removedPeer) => this.emit('peer left', removedPeer))

    return differences.added.length > 0 || differences.removed.length > 0
  }
}
