'use strict'

const debug = require('debug')('tevere:persister')
const waterfall = require('async/waterfall')
const series = require('async/series')
const each = require('async/each')

module.exports = class Persister {
  constructor (ipfs, log) {
    this._ipfs = ipfs
    this._log = log
  }

  persistRecursive (cid, callback) {
    const newLogEntries = []

    this._ensureLogEntry(newLogEntries, cid, (err) => {
      if (err) {
        callback(err)
      } else {
        callback(null, newLogEntries)
      }
    })
  }

  _ensureLogEntry (newLogEntries, cid, callback) {
    if (!cid) {
      throw new Error('need a CID')
    }
    this._log.get(cid, (err, entry) => {
      if (err) {
        callback(err)
        return // early
      }

      debug('log entry in cache: %j', entry)
      if (!entry || entry.isNew) {
        newLogEntries.push(cid)
        waterfall(
          [
            (callback) => this._ipfs.dag.get(cid, callback),
            (logEntry, callback) => {
              const newEntry = Object.assign({}, logEntry.value, { isNew: true })
              series([
                (callback) => this._log.set(cid, newEntry, callback),
                (callback) => {
                  if (logEntry.value.parents) {
                    each(
                      logEntry.value.parents,
                      this._ensureLogEntry.bind(this, newLogEntries),
                      callback)
                  } else {
                    callback()
                  }
                }
              ], callback)
            }
          ],
          callback)
      } else {
        callback()
      }
    })
  }
}
