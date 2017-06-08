# tevere

> Decentralized DB over IPFS

[![Build Status](https://travis-ci.org/pgte/tevere.svg?branch=master)](https://travis-ci.org/pgte/tevere)

## Install

```bash
$ npm install tevere --save
```

## Use

```js
const Tevere = require('tevere')

const db = Tevere('partition name')

db.put('key', { val: 'ue' }, (err) => {
  if (err) {
    throw err
  }
  console.log('PUT succeeded')
})
```

## Tevere instance API

A Tever instance respects the [Leveldown API](https://github.com/level/leveldown#api). Here are the main methods:

### .put (key, value, callback)

Save a value to key.

### .get (key, callback)

Get the value stored in `key`.

### .iterator (options)

Returns an iterator over the database. Supports [the same options described in the Leveldown API](https://github.com/level/leveldown#leveldown_iterator).

### Events

A Tevere instance emits these event types:

#### `change (change)`

Every time there is a change (either local or remote), a Tevere instance emits a `change` event, which is an object that has these properties:

* `type` (string, either "del" or "put")
* `key` (string)
* `value` (any, relevant for `put` type operations)


# License

MIT

## Contribute

Feel free to join in. All welcome. Open an [issue](https://github.com/pgte/ipfs-level/issues)!

This repository falls under the IPFS [Code of Conduct](https://github.com/ipfs/community/blob/master/code-of-conduct.md).

[![](https://cdn.rawgit.com/jbenet/contribute-ipfs-gif/master/img/contribute.gif)](https://github.com/ipfs/community/blob/master/contributing.md)

## License

[MIT](LICENSE)
