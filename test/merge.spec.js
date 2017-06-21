/* eslint-env mocha */
'use strict'

const chai = require('chai')
chai.use(require('dirty-chai'))
const expect = chai.expect

const Memdown = require('memdown')
const each = require('async/each')

const Tevere = require('../')
const createRepo = require('./utils/create-repo-node')

const PARTITION = 'merge-test'

describe('merge', () => {
  const repos = []
  let db1, db2

  before((done) => {
    const repo = createRepo()
    repos.push(repo)
    db1 = Tevere(PARTITION, {
      ipfsOptions: {
        repo: repo
      },
      log: Memdown(PARTITION + ':db1'),
      merge: merge
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
      log: Memdown(PARTITION + ':db2'),
      merge: merge
    })
    db2.open(done)
  })

  after((done) => each(repos, (repo, cb) => repo.teardown(cb), done))

  it('merges', (done) => {
    const dbChangeCount = [0, 0]
    const dbs = [db1, db2]

    dbs.forEach((db, index) => {
      db.on('change', (change) => {
        if (change.key === 'conflicting key') {
          if (++dbChangeCount[index] === 2) {
            expect(change.value).to.deep.equal(['value 1', 'value 2'])
            maybeDone()
          }
        }
      })
    })

    function maybeDone () {
      if (dbChangeCount.every((count) => count === 2)) {
        done()
      }
    }

    db1.put('conflicting key', 'value 1', expectNoError)
    db2.put('conflicting key', 'value 2', expectNoError)
  })
})

function merge (v1, v2) {
  return [v1, v2]
}

function expectNoError (err) {
  if (err) {
    throw err
  }
}
