'use strict'

const EventEmitter = require('events')
const backoff = require('backoff').fibonacci
const debug = require('debug')('tevere:sync')

const Room = require('ipfs-pubsub-room')

// TODO: tweak these values to generate less traffic
const BACKOFF_OPTIONS = {
  initialDelay: 1000,
  maxDelay: 4000
}

module.exports = class Sync extends EventEmitter {
  constructor (nodeId, partition, log, ipfs) {
    super()

    this._nodeId = nodeId
    this._topic = '/ipfs-level/' + partition
    this._log = log
    this._ipfs = ipfs
    this._head = undefined
    this._stopped = false

    this._backoff = backoff(BACKOFF_OPTIONS)
    this._backoff.on('ready', this._broadcast.bind(this))
    this._backoff.backoff()

    this._room = Room(ipfs, this._topic)
    this._room.on('peer joined', () => {
      this._backoff.reset()
      this._broadcast()
    })
    this._room.on('error', (err) => this.emit('error', err))

    this._ipfs.pubsub.subscribe(this._topic, this._onMessage.bind(this))
  }

  setNewHead (head) {
    debug('setting new head to %s', head)
    this._head = head
    this._backoff.reset()
    this._broadcast()
  }

  stop () {
    this._stopped = true
    this._room.close()
  }

  _broadcast () {
    if (this._stopped) {
      return
    }

    if (this._head) {
      this._room.broadcast(Buffer.from(this._head))
    }
    this._backoff.backoff()
  }

  _onMessage (message) {
    if (message.from !== this._nodeId) {
      this.emit('new head', message.data.toString())
    }
  }
}
