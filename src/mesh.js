'use strict';

const net = require('net');
const { id } = require('./utils');
const { current: log } = require('./logger');
const { Message, Messages } = require('./parser');

const PeerReconnectDelay = 1000; // 1 sec

class Mesh {
    constructor(name, peers, sessions) {
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

                const session = this.sessions.get(socket.peer);
                if (session) {
                    session.inbound = null;
                }

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

                const session = this.sessions.get(socket.peer);
                if (session) {
                    session.inbound = null;
                }

                setImmediate(() => {
                    socket.removeAllListeners();
                    socket.peer = null;
                });
            })
            .on('data', (data) => {
                let session = this.sessions.get(socket.peer);
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

                    session = this.sessions.start(socket.peer);
                    session.inbound = socket;
                }

                // todo: handle protocol request

                session.inboundBuf = msg.tail;
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

                this.sessions.start(socket.peer).outbound = socket;
            })
            .on('error', (err) => {
                log.error(`Connecting peer failed: ${err.message}`, socket);

                const session = this.sessions.get(socket.peer);
                if (session) {
                    session.outbound = null;
                }

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

                const session = this.sessions.get(socket.peer);
                if (session) {
                    session.outbound = null;
                }

                setImmediate(() => {
                    socket.removeAllListeners();
                    socket.peer = null;
                });

                setTimeout(() => {
                    this.connectPeer(peer);
                }, PeerReconnectDelay);
            })
            .on('data', (data) => {
                const session = this.sessions.get(socket.peer).outboundBuffer.concat(data);
                data = session.outboundBuffer.concat(data);

                const msg = Message.parse(data);
                log.info(`Peer message: ${Messages[msg.type]} > ${msg.data}`, socket);

                if (!msg) {
                    session.outboundBuffer = data;
                    return;
                }

                // todo: handle protocol response

                session.outboundBuf = msg.tail;
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
                socket.end();
                socket.removeAllListeners();
                socket.on('error', function () {});
                socket.destroy();
                socket.peer = null;
            }

            this.sessions.stop(peer);
        }
    }
}

module.exports.Mesh = Mesh;
