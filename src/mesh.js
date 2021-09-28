'use strict';

const net = require('net');
const EventEmitter = require('events');

const { id } = require('./utils');
const { current: log } = require('./logger');
const { Message, Messages } = require('./parser');

const PeerReconnectDelay = 1000; // 1 sec

class Mesh extends EventEmitter {
    constructor(name, peers, sessions) {
        super();
        this.peerName = name;
        this.peers = peers;
        this.sessions = sessions;
    }

    accept(socket) {
        socket.id = id();
        log.info(`Peer connected`, socket);

        socket
            .on('error', (err) => {
                log.error(`Peer connection failed: ${err.message}`, socket);

                this.emit('inbound_failed', socket.peer);

                socket.end();
                setImmediate(() => {
                    socket.removeAllListeners();
                    socket.on('error', function () {});
                    socket.destroy();
                    socket.peer = null;
                });
            })
            .on('end', () => {
                log.info(`Peer disconnected`, socket);

                this.emit('inbound_ended', socket.peer);

                setImmediate(() => {
                    socket.removeAllListeners();
                    socket.peer = null;
                });
            })
            .on('data', (data) => {
                const session = this.sessions.get(socket.peer);
                if (session) {
                    data = session.inboundBuffer.concat(data);
                }

                const msg = Message.parse(data);
                log.info(`Peer message: ${Messages[msg.type]} > ${msg.data}`, socket);

                // expect hello message to fit in buffer
                if (!msg && !session) {
                    return;
                }
                if (!msg) {
                    session.inboundBuffer = data;
                    return;
                }

                // handle hello (connect peer)
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

                    this.emit('inbound_started', socket.peer, socket);
                }

                // todo: handle bye (disconnect peer)

                this.emit('inbound_message', socket.peer, msg);
            });
    }

    connect() {
        for (const peer of this.peers) {
            if (this.peerName === peer.name) {
                continue;
            }
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

                this.emit('outbound_started', socket.peer, socket);
            })
            .on('error', (err) => {
                log.error(`Connecting peer failed: ${err.message}`, socket);

                this.emit('outbound_failed', socket.peer);

                socket.end();
                setImmediate(() => {
                    socket.removeAllListeners();
                    socket.on('error', function () {});
                    socket.destroy();
                    socket.peer = null;
                });

                setTimeout(() => {
                    this.connectPeer(peer);
                }, PeerReconnectDelay);
            })
            .on('end', () => {
                log.info(`Peer disconnected`, socket);

                this.emit('outbound_ended', socket.peer);

                setImmediate(() => {
                    socket.removeAllListeners();
                    socket.peer = null;
                });

                setTimeout(() => {
                    this.connectPeer(peer);
                }, PeerReconnectDelay);
            })
            .on('data', (data) => {
                const session = this.sessions.get(socket.peer);
                data = session.outboundBuf.concat(data);

                const msg = Message.parse(data);
                log.info(`Peer message: ${Messages[msg.type]} > ${msg.data}`, socket);

                if (!msg) {
                    session.outboundBuf = data;
                    return;
                }

                this.emit('outbound_message', socket.peer, msg);
            });

        socket.id = id();
        socket.peer = peer;

        log.info(`Connecting peer`, socket);
    }

    disconnect() {
        for (const peer of this.peers) {
            if (this.peerName === peer.name) {
                continue;
            }
            const session = this.sessions.get(peer);
            if (!session) {
                continue;
            }

            for (const socket of [session.inbound, session.outbound].filter((s) => !!s)) {
                socket.removeAllListeners();
                socket.on('error', function () {});
                socket.end();
                socket.destroy();
                socket.peer = null;
            }

            this.emit('peer_disconnected', peer);
        }
    }
}

module.exports.Mesh = Mesh;
