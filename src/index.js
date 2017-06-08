'use strict'

const Tevere = require('./tevere')

module.exports = (partition, options) => {
  return new Tevere(partition, options)
}
