'use strict';

const { current: log } = require('./logger');
const { timestamp } = require('./utils');
const { Messages, Message } = require('./parser');

const ElectionTakeOverTimeout = 100; // msec
const ElectionTimeout = 200; // msec

class BullyElection {
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
        this.mesh.on('message', (peer, msg) => this.handleMessage(peer, msg));
        this.mesh.on('connected', (peer, socket) => this.handleConnected(peer, socket));
        // this.mesh.on('disconnected', (peer) => this.handleDisconnected(peer));
        this.mesh.on('disconnected', (peer) => this.handleFailed(peer));
        this.mesh.on('failed', (peer) => this.handleFailed(peer));
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

    handleMessage(peer, msg) {
        if (msg.type === this.confirms.get(peer.name)) {
            const payload = JSON.parse(msg.data);
            if (payload.leaderName) {
                this.clearElection();
                this.leaderName = payload.leaderName;
                this.lastElection = timestamp();
                log.info(`Leader already elected: ${this.leaderName}`, peer);
            } else {
                this.clearElection(false);
                this.confirms.delete(peer.name);
                log.info(`Leader taking over`, peer);
            }
            return;
        }
        if (msg.type === Messages.Election) {
            // do not propagate if the leader is already elected
            let leaderName = null;
            if (this.leaderName > peer.name && this.lastElection) {
                leaderName = this.leaderName;
            }
            const session = this.sessions.get(peer);
            if (!session.send(Message.build(Messages.TakeOver, JSON.stringify({ leaderName })))) {
                log.warn(`Failed to take over`, peer);
            } else {
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

    handleConnected(peer, socket) {
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

module.exports.BullyElection = BullyElection;
