/* eslint-env mocha */
'use strict'

const chai = require('chai')
chai.use(require('dirty-chai'))
const expect = chai.expect

const Memdown = require('memdown')
const each = require('async/each')
const parallel = require('async/parallel')
const map = require('async/map')

const Tevere = require('../')
const createRepo = require('./utils/create-repo-node')

const PARTITION = 'sync-test'

describe('sync', () => {
  const repos = []
  let db1, db2, db3, electedKey3Value

  before((done) => {
    const repo = createRepo()
    repos.push(repo)
    db1 = Tevere(PARTITION, {
      ipfsOptions: {
        repo: repo
      },
      log: Memdown(PARTITION + ':db1')
    })
    db1.open(done)
  })

  before((done) => {
    const repo = createRepo()
    repos.push(repo)
    db2 = Tevere(PARTITION, {
      ipfsOptions: {
        repo: repo
      },
      log: Memdown(PARTITION + ':db2')
    })
    db2.open(done)
  })

  after((done) => each(repos, (repo, cb) => repo.teardown(cb), done))

  it('puts in one', (done) => {
    console.log('(1)')
    db2.once('change', (change) => {
      console.log('CHANGE:', change)
      expect(change.type).to.equal('put')
      expect(change.key).to.equal('key')
      expect(change.value).to.equal('value')
      done()
    })

    db1.put('key', 'value', (err) => {
      expect(err).to.not.exist()
      console.log('have putted..')
    })
  })

  it('puts some keys', (done) => {
    const waitingForNodes = { db1: true, db2: true }
    db1.on('change', (change) => {
      if (change.key === 'key 2') {
        expect(change.value).to.equal('value 2')
        waitingForNodes.db1 = false
        maybeDone()
      }
    })
    db2.on('change', (change) => {
      if (change.key === 'key 1') {
        expect(change.value).to.equal('value 1')
        waitingForNodes.db2 = false
        maybeDone()
      }
    })
    parallel(
      [
        (callback) => db1.put('key 1', 'value 1', callback),
        (callback) => db2.put('key 2', 'value 2', callback)
      ], expectNoError)

    function maybeDone () {
      if (!waitingForNodes.db1 && !waitingForNodes.db2) {
        done()
      }
    }
  })

  it('concurrent put', (done) => {
    const dbs = [db1, db2]
    const results = []
    let changes = 0

    dbs.forEach((db, index) => db.on('change', (change) => {
      if (change.key === 'key 3') {
        changes++
        results[index] = change.value
        maybeDone()
      }
    }))

    function maybeDone () {
      if (changes !== 3) {
        return // early
      }

      expect(results[0]).to.equal(results[1])
      expect(results[0]).to.be.oneOf(['value 3.1', 'value 3.2'])
      expect(results[1]).to.be.oneOf(['value 3.1', 'value 3.2'])
      electedKey3Value = results[0]
      done()
    }

    parallel(
      [
        (callback) => db1.put('key 3', 'value 3.1', callback),
        (callback) => db2.put('key 3', 'value 3.2', callback)
      ],
      expectNoError)
  })

  it('a third node appears', (done) => {
    let changes = 0
    const repo = createRepo()
    repos.push(repo)
    db3 = Tevere(PARTITION, {
      ipfsOptions: {
        repo: repo
      },
      log: Memdown(PARTITION + ':db3')
    })

    db3.on('change', (change) => {
      if (++changes !== 4) {
        return // early
      }

      map(
        ['1', '2', '3'],
        (key, callback) => {
          db3.get('key ' + key, { asBuffer: false }, (err, result) => {
            expect(err).to.not.exist()
            callback(null, result)
          })
        },
        (err, results) => {
          expect(err).to.not.exist()
          expect(results).to.deep.equal(['value 1', 'value 2', electedKey3Value])
          done()
        })
    })

    db3.open(expectNoError)
  })
})

function expectNoError (err) {
  if (err) {
    throw err
  }
}
