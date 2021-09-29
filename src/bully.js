'use strict';

class BullyElection {
    constructor(mesh, sessions) {
        this.mesh = mesh;
        this.sessions = sessions;
    }

    start() {
        this.mesh.on('message', (peer, message) => {
            const session = this.sessions.get(peer);
            this.handle(session, message);
        });
        this.mesh.on('connected', (peer, socket) => {
            this.sessions.start(peer, socket);
        });
        this.mesh.on('disconnected', (peer) => {
            if (peer) {
                this.sessions.stop(peer);
            }
        });
        this.mesh.on('failed', (peer) => {
            if (peer) {
                const session = this.sessions.get(peer);
                if (session) {
                    session.socket = null;
                }
            }
        });
    }

    handle(session, message) {
        // todo
    }
}

module.exports.BullyElection = BullyElection;
