'use strict';

const { current: log } = require('./logger');
const { timestamp } = require('./utils');
const { Messages, Message } = require('./parser');

const ElectionTakeOverTimeout = 100; // msec
const ElectionTimeout = 200; // msec

class TokenRingElection {
    constructor(mesh, sessions) {
        this.mesh = mesh;
        this.sessions = sessions;
        this.lastElection = 0;
        this.confirms = new Map();
        this.confirmsTimeout = null;
        this.electionTimeout = null;
    }

    start() {
        this.peerName = this.mesh.peerName;
        this.leaderName = this.peerName;
        this.mesh.on('connecting', (peers, callback) => this.handleConnecting(peers, callback));
        this.mesh.on('reconnecting', (peer, callback) => this.handleReconnecting(peer, callback));
        this.mesh.on('connected', (peer, socket) => this.handleConnected(peer, socket));
        this.mesh.on('disconnected', (peer) => this.handleFailed(peer)); // for testing only
        this.mesh.on('failed', (peer) => this.handleFailed(peer));
        this.mesh.on('message', (peer, msg) => this.handleMessage(peer, msg));
    }

    election(peer) {
        if (this.leaderName === null) {
            log.info(`Election is already in progress`, peer);
            return;
        }

        log.info(`Starting election`, peer);

        this.leaderName = null;
        let count = 0;

        for (const session of this.sessions) {
            // pre-elect peers with higher IDs
            if (!(session.ready && session.peer.name > this.peerName)) {
                continue;
            }

            log.info(`Nominating ${++count}`, session.peer);

            session.send(Message.build(Messages.Election));

            // expect election confirmation
            this.confirms.set(session.peer.name, Messages.TakeOver);
        }

        if (count) {
            this.confirmsTimeout = setTimeout(() => {
                // become a leader if others have not confirmed the election
                this.clearElection();
                this.lead();
            }, ElectionTakeOverTimeout);
            this.electionTimeout = setTimeout(() => {
                // re-start election if it is expired
                log.warn(`Election is expired, re-starting`, peer);
                this.clearElection();
                this.leaderName = this.peerName;
                this.election(peer);
            }, ElectionTimeout);
            return;
        }

        // become a leader if there are no peers with higher ID
        this.lead();
    }

    lead() {
        // let all active peers know who is the leader
        // note, not all active peers can be ready by this time,
        // thus they may re-start election
        for (const session of this.sessions) {
            if (!session.ready) {
                continue;
            }

            log.info(`Leading`, session.peer);
            session.send(Message.build(Messages.Leader));
        }

        // conclude by updating leader state
        this.leaderName = this.peerName;
        this.lastElection = timestamp();
        log.info(`Leader elected: ${this.leaderName}`);
    }

    // todo: implement
    handleMessage(peer, msg) {
        if (msg.type === Messages.TakeOver) {
            const payload = JSON.parse(msg.data);

            // accept already elected leader
            if (payload.leaderName) {
                this.clearElection();
                this.leaderName = payload.leaderName;
                this.lastElection = timestamp();
                log.info(`Leader already elected: ${this.leaderName}`, peer);
            }

            // resolve election confirmation
            else if (msg.type === this.confirms.get(peer.name)) {
                this.clearElection(false);
                this.confirms.delete(peer.name);
                log.info(`Leader taking over`, peer);
            }
            return;
        }
        if (msg.type === Messages.Election) {
            // check whether there is a valid leader elected
            let leaderName = null;
            if (this.leaderName > peer.name && this.lastElection) {
                leaderName = this.leaderName;
            }

            // confirm election round
            const session = this.sessions.get(peer);
            if (!session.send(Message.build(Messages.TakeOver, JSON.stringify({ leaderName })))) {
                log.warn(`Failed to take over`, peer);
            }

            // do not propagate if the leader is already elected
            if (!leaderName) {
                this.election(peer);
            }
            return;
        }
        if (msg.type === Messages.Leader) {
            this.clearElection();
            this.leaderName = peer.name;
            this.lastElection = timestamp();
            log.info(`Leader elected: ${this.leaderName}`, peer);
            return;
        }
        log.warn(`Unexpected message: ${JSON.stringify(msg)}`, peer);
    }

    handleConnecting(peers, callback) {
        // todo: connect to the next peer only
        callback(peers.filter((p) => p.name > this.peerName));
    }

    handleReconnecting(peer, callback) {
        // todo: reconnect to the next peer
        callback(peer);
    }

    handleConnected(peer, socket) {
        // todo: when 2nd peer with lower ID connected, ask the smallest
        // one to restart connection loop
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
}

module.exports.TokenRingElection = TokenRingElection;
