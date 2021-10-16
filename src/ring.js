'use strict';

const { current: log } = require('./logger');
const { timestamp } = require('./utils');
const { Messages, Message } = require('./parser');
const { Direction } = require('./session_store');

const ElectionConfirmTimeout = 100; // msec
const ElectionTimeout = 200; // msec
const PeerReconnectDeferTime = 1000; // 1 sec

class TokenRingElection {
    constructor(mesh, sessions) {
        this.mesh = mesh;
        this.sessions = sessions;
        this.lastElection = 0;
        this.confirms = new Map();
        this.confirmsTimeout = null;
        this.electionTimeout = null;
        this.reconnect = false;
    }

    start() {
        this.peers = this.mesh.peers;
        this.peerName = this.mesh.peerName;
        this.leaderName = this.peerName;
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
        // if (this.leaderName === null) {
        //     log.info(`Election is already in progress`, peer);
        //     return;
        // }
        // log.info(`Starting election`, peer);
        // this.leaderName = null;
        // let count = 0;
        // for (const session of this.sessions) {
        //     // pre-elect peers with higher IDs
        //     if (!(session.ready && session.peer.name > this.peerName)) {
        //         continue;
        //     }
        //     log.info(`Nominating ${++count}`, session.peer);
        //     session.send(Message.build(Messages.Election));
        //     // expect election confirmation
        //     this.confirms.set(session.peer.name, Messages.Confirm);
        // }
        // if (count) {
        //     this.confirmsTimeout = setTimeout(() => {
        //         // become a leader if others have not confirmed the election
        //         this.clearElection();
        //         this.lead();
        //     }, ElectionConfirmTimeout);
        //     this.electionTimeout = setTimeout(() => {
        //         // re-start election if it is expired
        //         log.warn(`Election is expired, re-starting`, peer);
        //         this.clearElection();
        //         this.leaderName = this.peerName;
        //         this.election(peer);
        //     }, ElectionTimeout);
        //     return;
        // }
        // // become a leader if there are no peers with higher ID
        // this.lead();
    }

    clearElection(finish = true) {
        if (this.confirmsTimeout) {
            clearTimeout(this.confirmsTimeout);
            this.confirmsTimeout = null;
        }
        if (this.electionTimeout && finish) {
            clearTimeout(this.electionTimeout);
            this.electionTimeout = null;
        }
        if (this.confirms.size && finish) {
            log.warn(`Leaders not participating: ${Array.from(this.confirms.keys())}`);
            this.confirms.clear();
        }
    }

    // todo: implement
    handleMessage(peer, msg) {
        if (msg.type === Messages.Reconnect) {
            this.restart = true;
            return;
        }
        // if (msg.type === Messages.Confirm) {
        //     const payload = JSON.parse(msg.data);

        //     // accept already elected leader
        //     if (payload.leaderName) {
        //         this.clearElection();
        //         this.leaderName = payload.leaderName;
        //         this.lastElection = timestamp();
        //         log.info(`Leader already elected: ${this.leaderName}`, peer);
        //     }

        //     // resolve election confirmation
        //     else if (msg.type === this.confirms.get(peer.name)) {
        //         this.clearElection(false);
        //         this.confirms.delete(peer.name);
        //         log.info(`Leader taking over`, peer);
        //     }
        //     return;
        // }
        // if (msg.type === Messages.Election) {
        //     // check whether there is a valid leader elected
        //     let leaderName = null;
        //     if (this.leaderName > peer.name && this.lastElection) {
        //         leaderName = this.leaderName;
        //     }

        //     // confirm election round
        //     const session = this.sessions.get(peer);
        //     if (!session.send(Message.build(Messages.Confirm, JSON.stringify({ leaderName })))) {
        //         log.warn(`Failed to take over`, peer);
        //     }

        //     // do not propagate if the leader is already elected
        //     if (!leaderName) {
        //         this.election(peer);
        //     }
        //     return;
        // }
        // if (msg.type === Messages.Leader) {
        //     this.clearElection();
        //     this.leaderName = peer.name;
        //     this.lastElection = timestamp();
        //     log.info(`Leader elected: ${this.leaderName}`, peer);
        //     return;
        // }
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
        const session = this.sessions.get(peer);
        if (session && session.ready) {
            log.debug(`Skipping reconnect - session active`, peer);
            setTimeout(() => this.handleReconnecting(peer, callback), PeerReconnectDeferTime);
            return;
        }

        callback(null, [peer]);
    }

    handleConnected(peer, socket) {
        // do not keep more than 1 incoming session to form a ring
        if (socket.incoming) {
            const incoming = this.sessions.getFirst(Direction.Incoming);
            if (incoming) {
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
