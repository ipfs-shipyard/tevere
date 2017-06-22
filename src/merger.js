'use strict'

const waterfall = require('async/waterfall')
const series = require('async/series')
const eachSeries = require('async/eachSeries')
const parallel = require('async/parallel')
const Queue = require('async/queue')
const vectorclock = require('vectorclock')
const debug = require('debug')

const decoding = require('./decoding')
const Persister = require('./persister')

module.exports = class Merger {
  constructor (nodeId, ipfs, log, merge) {
    this._nodeId = nodeId
    this._ipfs = ipfs
    this._log = log
    this._merge = merge
    this._headQueue = []
    this._persister = new Persister(this._ipfs, this._log)
    this._queue = Queue(this._processRemoteHead.bind(this), 1)
    this._debug = debug('tevere:merge:' + this._nodeId)
  }

  processRemoteHead (cid, callback) {
    if (this._headQueue.indexOf(cid) < 0) {
      this._debug('will process remote head %j, ...', cid)
      this._headQueue.push(cid)
      this._queue.push(cid, (err) => {
        this._headQueue.splice(this._headQueue.indexOf(cid), 1)
        callback(err)
      })
    } else {
      callback()
    }
  }

  _processRemoteHead (cid, callback) {
    this._debug('processing remote head %j, ...', cid)
    waterfall(
      [
        (callback) => this._persister.persistRecursive(cid, callback),
        (newLogEntries, callback) => {
          if (newLogEntries.length) {
            this._log.transaction(
              (callback) => {
                series(
                  [
                    (callback) => this._processNewRemoteLogEntries(cid, newLogEntries, callback),
                    (callback) => this._mergeHeads(cid, callback)
                  ],
                  callback)
              },
              callback)
          } else {
            callback()
          }
        }
      ],
      callback)
  }

  // TODO: no need to store all the new log entries CIDs
  // Since we have them stored, we just need to iteratively retrieve the parent nodes until covered
  // them all.
  _processNewRemoteLogEntries (remoteHeadCID, newLogEntries, callback) {
    newLogEntries = newLogEntries.reverse()

    this._debug('process new remote log entries: %j', newLogEntries)
    series([
      (callback) => {
        eachSeries(
          newLogEntries,
          (remoteEntryCID, callback) => {
            this._debug('processing remote log entry %s ...', remoteEntryCID)
            this._debug('trying to retrieve remote log entry from local cache')
            this._log.get(remoteEntryCID, decoding((err, remoteLogEntry) => {
              if (err) {
                this._debug('error trying to retrieve remote log entry from local cache:', err)
                callback(err)
                return // early
              }

              if (!remoteLogEntry) {
                this._debug('remote log entry %s was NOT found in cache', remoteEntryCID)
              }

              this._debug('processing new remote log entry for key %s: %j', remoteLogEntry.key, remoteLogEntry)

              if (!remoteLogEntry.key) {
                callback()
                return // early
              }

              this._log.getLatest(remoteLogEntry.key, (err, localLatestLogEntry, localLatestLogEntryCID) => {
                if (err) {
                  callback(err)
                  return // early
                }

                this._debug('local log entry for key %s is %j', remoteLogEntry.key, localLatestLogEntry)

                const compared = localLatestLogEntry
                  ? vectorclock.compare(localLatestLogEntry, remoteLogEntry)
                  : -1

                switch (compared) {
                  case -1:
                    // local latest log entry happened BEFORE remote one
                    // TODO
                    this._log.impose(remoteLogEntry.key, remoteEntryCID, callback)
                    break
                  case 1:
                    // local latest log entry happened AFTER remote one
                    // remote log entry is outdated, ignore it
                    callback()
                    break
                  case 0:
                    if (vectorclock.isIdentical(localLatestLogEntry, remoteLogEntry)) {
                      // local latest log entry is IDENTICAL to the remote one
                      callback()
                      return // early
                    }
                    this._debug('conflict for key %j', remoteLogEntry.key)
                    // local latest log entry is CONCURRENT to remote one

                    if (this._merge) {
                      this._merge(
                        localLatestLogEntryCID,
                        localLatestLogEntry,
                        remoteHeadCID,
                        remoteLogEntry,
                        callback)
                      return // early
                    }

                    const chosenEntry = chooseOne([localLatestLogEntryCID, remoteEntryCID])
                    this._debug('chosen entry: %j', chosenEntry)
                    if (chosenEntry === remoteEntryCID) {
                      this._log.impose(remoteLogEntry.key, remoteEntryCID, callback)
                    } else {
                      // our entry won, ignore remote one
                      callback()
                    }
                }
              })
            }))
          },
          callback
        )
      },
      (callback) => {
        this._debug('going to mark new log entries as visited: %j', newLogEntries)
        eachSeries(
          newLogEntries,
          (entryCID, callback) => {
            waterfall([
              (callback) => this._log.get(entryCID, callback),
              (entry, callback) => {
                delete entry.isNew
                callback(null, entry)
              },
              (entry, callback) => this._log.set(entryCID, entry, callback)
            ], callback)
          },
          callback)
      }
    ], callback)
  }

  _mergeHeads (remoteHeadCID, callback) {
    this._debug('going to determine if setting HEAD is required...', remoteHeadCID)
    parallel(
      {
        local: (callback) => this._log.getLatestHead(callback),
        remote: (callback) => this._log.get(remoteHeadCID, callback)
      },
      (err, results) => {
        if (err) {
          callback(err)
          return // early
        }

        const localHead = results.local[0]
        const localHeadCID = results.local[1]
        const remoteHead = results.remote

        this._debug('local head:', localHead)
        this._debug('remote head:', remoteHead)

        if (!localHeadCID) {
          this._log.setHeadCID(remoteHeadCID, callback)
          return // early
        }

        if (localHeadCID === remoteHeadCID) {
          this._debug('heads %j and %j are the same')
          callback()
          return // early
        }

        const parents = [remoteHeadCID, localHeadCID].sort()

        const mergeHead = {
          parents: parents,
          clock: vectorclock.merge(localHead.clock, remoteHead.clock)
        }

        this._log.setHead(mergeHead, callback)
      }
    )
  }
}

function chooseOne (entries) {
  return entries.sort()[entries.length - 1]
}
