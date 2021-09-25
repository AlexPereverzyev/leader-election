'use strict';

const net = require('net');
const { id } = require('./utils');
const { current: log } = require('./logger');
const { Message, Messages } = require('./parser');

const PeerReconnectDelay = 1000; // 1 sec

class Mesh {
    constructor(name, peers) {
        this.peerName = name;
        this.peers = peers;
    }

    accept(socket) {
        socket.id = id();
        log.info(`Peer connected`, socket);

        socket
            .on('error', (err) => {
                log.error(`Peer connection failed: ${err.message}`, socket);

                socket.end();
                // todo: clear inbound session

                setImmediate(() => {
                    socket.removeAllListeners();
                    socket.on('error', function () {});
                    socket.destroy();
                });
            })
            .on('end', () => {
                log.info(`Peer disconnected`, socket);

                // todo: clear inbound session

                setImmediate(() => {
                    socket.removeAllListeners();
                });
            })
            .on('data', (data) => {
                // todo: concat inboundBuffer and data

                const msg = Message.parse(data);
                if (!msg) {
                    return;
                }

                // identify peer
                if (!socket.peer) {
                    if (!(msg.type === Messages.Hello && msg.data)) {
                        socket.end();
                        return;
                    }

                    const payload = JSON.parse(msg.data);
                    socket.peer = this.peers[payload.name];

                    if (!socket.peer) {
                        socket.end();
                        return;
                    }

                    // todo: set inbound session (handshake)
                }

                log.info(`Peer message: ${Messages[msg.type]} > ${msg.data}`, socket);

                // todo: handle protocol request
            });
    }

    connect(peerNetwork) {
        for (const peer of peerNetwork) {
            this.connectPeer(peer);
        }
    }

    connectPeer(peer) {
        const address = peer.address.split(':');
        const socket = net
            .createConnection(address[1], address[0], () => {
                log.info(`Connected peer`, socket);

                socket.write(
                    Message.build(
                        Messages.Hello,
                        JSON.stringify({
                            id: socket.id,
                            name: this.peerName,
                        }),
                    ),
                );

                // todo: set outbound session

                // todo: just a test
                // setImmediate(() => socket.end());
            })
            .on('error', (err) => {
                log.error(`Connecting peer failed: ${err.message}`, socket);

                socket.end();
                // todo: clear outbound session

                setImmediate(() => {
                    socket.removeAllListeners();
                    socket.on('error', function () {});
                    socket.destroy();
                });
                setTimeout(() => {
                    this.connectPeer(peer);
                }, PeerReconnectDelay);
            })
            .on('end', () => {
                log.info(`Peer disconnected`, socket);

                // todo: clear outbound session

                setImmediate(() => {
                    socket.removeAllListeners();
                });
                setTimeout(() => {
                    this.connectPeer(peer);
                }, PeerReconnectDelay);
            })
            .on('data', (data) => {
                const msg = Message.parse(data);
                if (!msg) {
                    return;
                }

                log.info(`Peer message: ${Messages[msg.type]} > ${msg.data}`, socket);

                // todo: handle protocol response
            });

        socket.id = id();
        socket.peer = peer;

        log.info(`Connecting peer`, socket);
    }
}

module.exports.Mesh = Mesh;
