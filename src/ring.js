'use strict';

const { current: log } = require('./logger');
const { timestamp } = require('./utils');
const { Messages, Message } = require('./parser');
const { Direction } = require('./session_store');

const ElectionTimeout = 200; // msec
const PeerReconnectTime = 1000; // 1 sec

class TokenRingElection {
    constructor(mesh, sessions) {
        this.mesh = mesh;
        this.sessions = sessions;
        this.lastElection = 0;
        this.electionTimeout = null;
        this.reconnect = false;
    }

    start() {
        this.peers = this.mesh.peers;
        this.peerName = this.mesh.peerName;
        this.leaderName = this.mesh.peerName;
        this.mesh.on('failed', (peer) => this.handleFailed(peer));
        this.mesh.on('message', (peer, msg) => this.handleMessage(peer, msg));
        this.mesh.on('connected', (peer, socket) => this.handleConnected(peer, socket));
        this.mesh.on('disconnected', (peer) => this.handleFailed(peer)); // for testing only
        this.mesh.on('connecting', (callback) => this.handleConnecting(callback));
        this.mesh.on('reconnecting', (peer, callback) => {
            if (this.restart) {
                this.restart = false;
                this.handleConnecting(callback);
            } else {
                this.handleReconnecting(peer, callback);
            }
        });
    }

    election(peer) {
        if (this.leaderName === null) {
            log.info(`Election is already in progress`, peer);
            return;
        }

        const session = this.sessions.getAny();
        if (!session) {
            this.leaderName = this.peerName;
            log.warn(`Skipping election - no active session`);
            log.info(`Leader elected: ${this.leaderName}`, peer);
            return;
        }

        log.info(`Starting election`, peer);

        this.leaderName = null;

        // send election message to the ring
        session.send(Message.build(Messages.ElectionRound, JSON.stringify([this.peerName])));

        this.electionTimeout = setTimeout(() => {
            // re-start election if it is expired
            log.warn(`Election is expired, re-starting`, peer);
            this.clearElection();
            this.leaderName = this.peerName;
            this.election(peer);
        }, ElectionTimeout);
    }

    clearElection(finish = true) {
        if (this.electionTimeout && finish) {
            clearTimeout(this.electionTimeout);
            this.electionTimeout = null;
        }
    }

    handleMessage(peer, msg) {
        if (msg.type === Messages.Reconnect) {
            this.restart = true;
            return;
        }
        // try to send to outgoing session first, otherwise to incoming (2 peers network)
        const session = this.sessions.getAny();
        if (!session) {
            log.warn(`Skipping election round - no active session`);
            return;
        }
        if (msg.type === Messages.ElectionRound) {
            // check whether there is a valid leader elected already
            if (this.leaderName > peer.name && this.lastElection) {
                this.sessions
                    .get(peer)
                    .send(
                        Message.build(
                            Messages.Confirm,
                            JSON.stringify({ leaderName: this.leaderName }),
                        ),
                    );
                return;
            }

            // check round complete and elect a leader
            const payload = JSON.parse(msg.data);
            if (payload.includes(this.peerName)) {
                const leaderName = payload.sort()[payload.length - 1];
                session.send(
                    Message.build(
                        Messages.LeaderRound,
                        JSON.stringify({ leaderName, peerName: this.peerName }),
                    ),
                );
            }

            // otherwise - add own token and pass over
            else {
                payload.push(this.peerName);
                session.send(Message.build(Messages.ElectionRound, JSON.stringify(payload)));
            }
            return;
        }
        if (msg.type === Messages.Confirm) {
            // accept already elected leader
            const payload = JSON.parse(msg.data);
            this.clearElection();
            this.leaderName = payload.leaderName;
            this.lastElection = timestamp();
            log.info(`Leader already elected: ${this.leaderName}`, peer);
            return;
        }
        if (msg.type === Messages.LeaderRound) {
            const payload = JSON.parse(msg.data);
            this.clearElection();
            this.leaderName = payload.leaderName;
            this.lastElection = timestamp();
            log.info(`Leader elected: ${this.leaderName}`, peer);

            // originated from other peer - pass over to the ring
            if (payload.peerName !== this.peerName) {
                session.send(Message.build(Messages.LeaderRound, msg.data));
            }
            return;
        }
        log.warn(`Unexpected message: ${JSON.stringify(msg)}`, peer);
    }

    handleConnecting(callback) {
        // do not connect to self (1 peer network)
        if (!(this.peers && this.peers.length > 1)) {
            callback(null, []);
            return;
        }

        // walk right to connect to the next peer from self to form a ring
        const peer = this.peers[this.peerName + 1 === this.peers.length ? 0 : this.peerName + 1];
        callback(null, [peer]);
    }

    handleReconnecting(peer, callback) {
        // walk right to connect to the next peer from provided one to form a ring
        do {
            peer = this.peers[peer.name + 1 === this.peers.length ? 0 : peer.name + 1];
        } while (peer.name === this.peerName);

        // skip attempt if the next peer is already connected (2 peers network)
        if (this.sessions.isReady(peer)) {
            log.debug(`Skipping reconnect - session active`, peer);
            setTimeout(() => this.handleReconnecting(peer, callback), PeerReconnectTime);
            return;
        }

        callback(null, [peer]);
    }

    handleConnected(peer, socket) {
        // re-arrange ring when 2nd incoming connection accepted
        let incoming;
        if (socket.incoming && (incoming = this.sessions.getFirst(Direction.Incoming))) {
            const msg = Message.build(Messages.Reconnect);

            let p = this.peers[this.peerName];
            while (true) {
                // walk left to find the first peer from self that forms a ring
                p = this.peers[p.name - 1 < 0 ? this.peers.length - 1 : p.name - 1];

                if (p.name === incoming.peer.name) {
                    log.info(`Reconnecting peer`, peer);
                    socket.write(msg, () => socket.end());
                    return;
                }
                if (p.name === peer.name) {
                    log.info(`Reconnecting peer`, incoming.peer);
                    incoming.send(msg, () => incoming.socket.end());
                    break;
                }
            }
        }

        this.sessions.start(peer, socket);
        if (this.leaderName < peer.name) {
            this.election(peer);
        }
    }

    handleDisconnected(peer) {
        if (peer) {
            this.sessions.stop(peer);
            if (this.leaderName === peer.name) {
                this.election(peer);
            }
        }
    }

    handleFailed(peer) {
        if (peer) {
            const session = this.sessions.get(peer);
            if (session) {
                session.socket = null;
            }
            if (this.leaderName === peer.name) {
                this.election(peer);
            }
        }
    }
}

module.exports.TokenRingElection = TokenRingElection;
