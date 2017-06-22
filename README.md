# Tevere

> Decentralized eventually-consistent key-value store over IPFS

[![Build Status](https://travis-ci.org/pgte/tevere.svg?branch=master)](https://travis-ci.org/pgte/tevere)

## Install

```bash
$ npm install tevere --save
```

## Use

Here we're using Memdown as a log database, but you can use any database that conforms to the Leveldown interface (Level-js on the browser or Leveldown on Node.js):

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

### Custom merge function

By default, when a conflict exists (two nodes have concucrently performed a change on the same key), Tevere will determinstically choose one of the values for you. Instead, you can provide a synchronous merge function like this:

```js
const db = Tevere('partition name', {
  log: Memdown('partition name'),
  merge: merge
})

// custom merge function that merges two records
function merge (v1, v2) {
  return {
    a: v1.a,
    b: v2.b,
    c: v1.c.concat(v2.c),
    d: Math.max(v1.d, v2.d)
  }
}
```

#### Custom merge and determinism

If you define a custom merge function, the result must be deterministic. For every node involved in the same conflict, Tevere guarantees that the order of the values passed into the merge function is the same. In return, you must guarantee that, __given the same two values, you always return the same merged value.__

This means that you cannot generate data that is not deterministic, like random values or even time stamps.

Invalid merge function:

```js
function merge (v1, v2) {
  return {
    timestamp: Date.now()
  }
}
```

This is valid, though:

```js
function merge (v1, v2) {
  return {
    timestamp: Math.max(v1.timestamp, v2.timestamp)
  }
}
```

__Tevere's compromise: Given a specific conflict, the order of the two values passed into the merge function is always the same.__ This means that, if two nodes have conflicting changes, both nodes custom merge functions will be called with the exact same arguments in the exact same order.

__Your compromise: Determinism, purely funcional merge function__: given a sets of two conflicting values, you always return the same merged value, no matter at which node and at which time the merging occurs.


## Tevere API

### `Tevere (partition, options)`

Creates a Tevere instance.

* partition (string, mandatory): identifies the partition this node will participate in.
* options (object, mandatory): some options:
  * `ipfsOptions` (object, optional). [IPFS options object](https://github.com/ipfs/js-ipfs#advanced-options-when-creating-an-ipfs-node).
  * `log` (LevelDown-compatible database): this is where the node keeps the log entries (which only have a vector clock and a hash — all the actual data is kept in IPFS).
  * `ipfs` (IPFS object, optional): an IPFS object instance. If you already can provide an IPFS object, pass it in here.
  * `merge` (function, optional): a synchronous function that will receive two values and return a new value.

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
