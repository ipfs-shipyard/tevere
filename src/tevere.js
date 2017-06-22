'use strict'

const IPFSLevel = require('ipfs-level').IPFSLevel
const merge = require('deep-assign')
const clone = require('lodash.clonedeep')
const debug = require('debug')('tevere:tevere')
const map = require('async/map')
const waterfall = require('async/waterfall')

const defaultOptions = require('./options')
const Merger = require('./merger')
const Sync = require('./sync')

const mandatoryOptions = {
  retainLog: true
}

const OPTIONS = {
  dag: {
    put: {
      format: 'dag-cbor'
    }
  }
}

module.exports = class Tevere extends IPFSLevel {
  constructor (partition, _options) {
    const options = merge({}, clone(defaultOptions), _options, mandatoryOptions)
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

      this._merger = new Merger(nodeId, ipfs, log, this._options.merge && this._merge.bind(this))

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

  _merge (localLatestLogEntryCID, localLogEntry, remoteHeadCID, remoteLogEntry, callback) {
    map(
      [localLogEntry.cid, remoteLogEntry.cid].sort(),
      (cid, callback) => this._ipfs.dag.get(cid, callback),
      (err, records) => {
        if (err) {
          callback(err)
          // return // early
        }
        const mergedValue = this._options.merge(records[0].value, records[1].value)
        const parentCIDs = [localLatestLogEntryCID, remoteHeadCID]
        const parentVectorClocks = [localLogEntry, remoteLogEntry]

        waterfall(
          [
            (callback) => this._ipfs.dag.put(mergedValue, OPTIONS.dag.put, callback),
            (cid, callback) => {
              callback(null, cid)
            },
            (cid, callback) => this._log.save(
              localLogEntry.key, cid.toBaseEncodedString(), parentCIDs, parentVectorClocks, callback)
          ],
          callback)
        // this.log().setHead(logEntry, callback)
      }
    )
  }
}
