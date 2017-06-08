# ipfs-level Internals

# Local put

When a node does a `db.put(key, value, callback)`, this is what happens inside that node:

* the key and value are encoded into a single document. We'll call this the 'kv-doc'
* This kv-doc is written onto IPFS (using the IPFS DAG API)
* IPFS gives you a Content ID (CID) in return, which uniquely identifies this document.
* The node retrieves the latest log entry (the latest HEAD) from the local log
* A new log entry is created. This entry contains:
  * `parent`: the CID from the latest HEAD
  * `key`: the kv-doc key
  * `cid`: the CID the kv-doc
  * `clock`: the updated vector clock, where the entry for the current node was incremented
* This new log entry is written into the IPFS, using the DAG API
* IPFS gives you a CID for that log entry
* The node uses the CID as a key to save the log entry into the log
* The node saves the log entry into the log using a key derived from the kv-doc key. This way it's easy to retrieve the latest log entry for a given value.
* The node saves the log entry under the key `HEAD`, to be able to later retrieve it

# Remote update

When a node gets a remote log update, the message contains the latest log entry (the remote HEAD), which contains:
  * `parent`: the remote parent log entre
  * `key`: the update this log entry pertains to
  * `cid`: the CID of the remote kv-doc that originated this entry
  * `clock`: the remote vector clock that this log entry generated

Upon receiving this message, the node goes thtough these procedures:

* Full log retrieval:
  * If the node already contains the parent log entry of the remote log entry, nothing is done
  * Otherwise, it retrieves the parent log entry and stores it in the log
  * Repeats these steps until all log entries are here
* Log sorting:
  * Collects all the new log entries
  * Sorts them in temporal order
* Log entry processing: starting from the earliest log entry, for each entry:
  * retrieves the latest local log entry for that key
  * compares the remote and local vector clock:
  * if the remote vector clock precedes the local one: do nothing
  * if the local vector clock precedes the remote one:
    * point the latest entry for that key the new log entry
  * if the local vector clock is concurrent with the remote one:
    * here we have to deterministically pick one of the log entries as the winning one.
    * pick the log entry with the highest CID
    * if the remote log entry wins, point the latest entry for that key to this new entry.
* HEAD update
  * compare both the remote and the local head.
  * if the local head precedes the remote one, point the new HEAD to the remote HEAD
  * if the remote head precedes the local one, do nothing
  * if both entries are concurrent, pick the one with the highest CID and set HEAD to that one.
* HEAD broadcast
  * Whenever there is a change in the HEAD pointer, use IPFS pubsub to broadcast that change to all interested nodes.
