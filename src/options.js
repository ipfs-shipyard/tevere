'use strict'

module.exports = {
  ipfsOptions: {
    config: {
      Addresses: {
        Swarm: [
          '/libp2p-webrtc-star/dns4/star-signal.cloud.ipfs.team/wss'
        ]
      },
      Discovery: {
        webRTCStar: {
          Enabled: true
        }
      }
    },
    EXPERIMENTAL: {
      pubsub: true
    }
  }
}
