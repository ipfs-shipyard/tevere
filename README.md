# Tevere

> Decentralized DB over IPFS

[![Build Status](https://travis-ci.org/pgte/tevere.svg?branch=master)](https://travis-ci.org/pgte/tevere)

## Install

```bash
$ npm install tevere --save
```

## Use

```js
const Tevere = require('tevere')
const Memdown = require('memdown')

const db = Tevere('partition name', {
  log: Memdown('partition name')
})

db.put('key', { val: 'ue' }, (err) => {
  if (err) {
    throw err
  }
  console.log('PUT succeeded')
})
```

## Tevere API

### `Tevere (partition, options)`

Creates a Tevere instance.

* partition (string, mandatory): identifies the partition this node will participate in.
* options (object, mandatory): some options:
  * `ipfsOptions` (object, optional). [IPFS options object](https://github.com/ipfs/js-ipfs#advanced-options-when-creating-an-ipfs-node).
  * `log` (LevelDown-compatible database): this is where the node keeps the log entries (which only have a vector clock and a hash — all the actual data is kept in IPFS).
  * `ipfs` (IPFS object, optional): an IPFS object instance. If you already can provide an IPFS object, pass it in here.

A Tevere instance respects the [Leveldown API](https://github.com/level/leveldown#api). Here are the main methods:

### db.put (key, value, callback)

Save a value to key.

### db.get (key, callback)

Get the value stored in `key`.

### .iterator (options)

Returns an iterator over the database. Supports [the same options described in the Leveldown API](https://github.com/level/leveldown#leveldown_iterator).

### Events

A Tevere instance emits these event types:

#### `"change" (change)`

Every time there is a change (either local or remote), a Tevere instance emits a `change` event, which is an object that has these properties:

* `type` (string, either "del" or "put")
* `key` (string)
* `value` (any, relevant for `put` type operations)

# Examples

Check [the tests dir](test) for some examples.

# Internals

Internal workings are [documented here](docs/INTERNALS.md).

# License

MIT

## Contribute

Feel free to join in. All welcome. Open an [issue](https://github.com/pgte/ipfs-level/issues)!

This repository falls under the IPFS [Code of Conduct](https://github.com/ipfs/community/blob/master/code-of-conduct.md).

[![](https://cdn.rawgit.com/jbenet/contribute-ipfs-gif/master/img/contribute.gif)](https://github.com/ipfs/community/blob/master/contributing.md)

## License

[MIT](LICENSE)
