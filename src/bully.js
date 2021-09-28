'use strict';

class BullyElection {
    constructor(mesh, sessions) {
        this.mesh = mesh;
        this.sessions = sessions;
    }

    start() {
        this.mesh.on('inbound_message', (peer, msg) => {
            const session = this.sessions.get(peer);
            session.inboundBuf = msg.tail;
            this.handle(session, msg);
        });
        this.mesh.on('inbound_started', (peer, socket) => {
            this.sessions.start(peer).inbound = socket;
        });
        this.mesh.on('inbound_ended', (peer) => {
            if (!peer) {
                return;
            }
            const session = this.sessions.get(peer);
            if (session) {
                session.inbound = null;
            }
        });
        this.mesh.on('inbound_failed', (peer) => {
            if (!peer) {
                return;
            }
            const session = this.sessions.get(peer);
            if (session) {
                session.inbound = null;
            }
        });

        this.mesh.on('outbound_message', (peer, msg) => {
            const session = this.sessions.get(peer);
            session.outboundBuf = msg.tail;
            this.handle(session, msg);
        });
        this.mesh.on('outbound_started', (peer, socket) => {
            this.sessions.start(peer).outbound = socket;
        });
        this.mesh.on('outbound_ended', (peer) => {
            if (!peer) {
                return;
            }
            const session = this.sessions.get(peer);
            if (session) {
                session.outbound = null;
            }
        });
        this.mesh.on('outbound_failed', (peer) => {
            if (!peer) {
                return;
            }
            const session = this.sessions.get(peer);
            if (session) {
                session.outbound = null;
            }
        });
        this.mesh.on('peer_disconnected', (peer) => {
            this.sessions.stop(peer);
        });
    }

    handle(session, msg) {
        // todo
    }
}

module.exports.BullyElection = BullyElection;
