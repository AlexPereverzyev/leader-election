'use strict';

const { current: log } = require('./logger');
const { Messages, Message } = require('./parser');

class BullyElection {
    constructor(mesh, sessions) {
        this.mesh = mesh;
        this.sessions = sessions;
        this.peerName = this.mesh.peerName;
        this.leaderName = this.mesh.peerName;
    }

    start() {
        this.mesh.on('message', (peer, msg) => this.handleMessage(peer, msg));
        this.mesh.on('connected', (peer, socket) => this.handleConnected(peer, socket));
        // this.mesh.on('disconnected', (peer) => this.handleDisconnected(peer));
        this.mesh.on('disconnected', (peer) => this.handleFailed(peer));
        this.mesh.on('failed', (peer) => this.handleFailed(peer));
    }

    handleMessage(peer, msg) {
        if (msg.type === Messages.Election) {
            this.election();
            return;
        }
        if (msg.type === Messages.Leader) {
            this.leaderName = peer.name;
            log.info(`Leader elected: ${this.leaderName}`, peer);
            return;
        }
        log.warn(`Unknown message: ${msg}`, peer);
    }

    handleConnected(peer, socket) {
        this.sessions.start(peer, socket);
        // todo: do not trigger election if joining network
        if (this.leaderName < peer.name) {
            this.election();
        }
    }

    handleDisconnected(peer) {
        if (peer) {
            this.sessions.stop(peer);
            if (this.leaderName === peer.name) {
                this.election();
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
                this.election();
            }
        }
    }

    election() {
        if (this.leaderName === null) {
            log.info(`Election in progress`);
            return;
        }

        this.leaderName = null;
        log.info(`Starting election`);

        let count = 0;

        for (const session of this.sessions) {
            if (!(session.ready && session.peer.name > this.peerName)) {
                continue;
            }

            log.info(`Nominating ${++count}`, session.peer);

            session.send(Message.build(Messages.Election));
        }

        if (count) {
            return;
        }

        for (const session of this.sessions) {
            if (!session.ready) {
                continue;
            }

            log.info(`Leading`, session.peer);
            session.send(Message.build(Messages.Leader));
        }

        this.leaderName = this.peerName;
        log.info(`Leader elected: ${this.leaderName}`);
    }
}

module.exports.BullyElection = BullyElection;
