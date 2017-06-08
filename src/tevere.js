'use strict'

const IPFSLevel = require('ipfs-level').IPFSLevel
const merge = require('deep-assign')
const clone = require('lodash.clonedeep')
const debug = require('debug')('tevere:tevere')

const defaultOptions = require('./options')
const Merger = require('./merger')
const Sync = require('./sync')

module.exports = class Tevere extends IPFSLevel {
  constructor (partition, _options) {
    const options = merge({}, clone(defaultOptions), _options)
    super(partition, options)
  }

  _open (options, callback) {
    super._open(options, (err) => {
      if (err) {
        callback(err)
        return // early
      }

      const ipfs = this.ipfsNode()
      const nodeId = this.ipfsNodeId()
      const log = this.log()

      this._merger = new Merger(nodeId, ipfs, log)

      this._sync = new Sync(nodeId, this.partition(), log, ipfs)
      this._sync.on('error', (err) => this.emit('error', err))
      this._sync.on('new head', (newHeadCID) => {
        this.getLatestHeadCID((err, localHeadCID) => {
          if (err) {
            this.emit('error', err)
            return // early
          }

          if (localHeadCID === newHeadCID) {
            return // early
          }

          debug('remote head: %j', newHeadCID)

          this._merger.processRemoteHead(newHeadCID, (err) => {
            if (err) {
              this.emit('error', err)
            }
            debug('finished processing remote head %s', newHeadCID)
          })
        })
      })

      this.on('new head', (cid) => {
        this._sync.setNewHead(cid)
      })

      callback()
    })
  }
}
