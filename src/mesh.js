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

                socket.end();
                this.sessions.start(socket.peer).inbound = null;

                setImmediate(() => {
                    socket.removeAllListeners();
                    socket.on('error', function () {});
                    socket.destroy();
                });
            })
            .on('end', () => {
                log.info(`Peer disconnected`, socket);

                this.sessions.start(socket.peer).inbound = null;

                setImmediate(() => {
                    socket.removeAllListeners();
                });
            })
            .on('data', (data) => {
                let session = this.sessions.get(socket.peer);
                if (session) {
                    data = session.inboundBuffer.concat(data);
                }

                const msg = Message.parse(data);
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

                if (msg.tail) {
                    session.inboundBuffer = msg.tail;
                } else {
                    session.inboundBuffer = Buffer.alloc(0);
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

                this.sessions.start(socket.peer).outbound = socket;
            })
            .on('error', (err) => {
                log.error(`Connecting peer failed: ${err.message}`, socket);

                socket.end();
                this.sessions.start(socket.peer).outbound = null;

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

                this.sessions.start(socket.peer).outbound = null;

                setImmediate(() => {
                    socket.removeAllListeners();
                });
                setTimeout(() => {
                    this.connectPeer(peer);
                }, PeerReconnectDelay);
            })
            .on('data', (data) => {
                const session = this.sessions.get(socket.peer).outboundBuffer.concat(data);
                data = session.outboundBuffer.concat(data);

                const msg = Message.parse(data);
                if (!msg) {
                    session.outboundBuffer = data;
                    return;
                }
                if (msg.tail) {
                    session.outboundBuffer = msg.tail;
                } else {
                    session.outboundBuffer = Buffer.alloc(0);
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
