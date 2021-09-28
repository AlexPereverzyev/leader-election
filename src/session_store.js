'use strict';

const { Session } = require('./session');

class SessionStore {
    constructor() {
        this.sessions = new Map();
    }

    get(peer) {
        return peer && peer.name !== undefined ? this.sessions.get(peer.name) : undefined;
    }

    start(peer) {
        let peerSession = this.sessions.get(peer.name);
        if (peerSession) {
            return peerSession;
        }

        peerSession = new Session();

        this.sessions.set(peer.name, peerSession);
        return peerSession;
    }

    stop(peer) {
        if (!peer) {
            return;
        }
        const peerSession = this.sessions.get(peer.name);
        if (!peerSession) {
            return;
        }
        if (peerSession.closed) {
            return;
        }

        this.sessions.delete(peer.name);

        peerSession.closed = true;
        peerSession.inbound = null;
        peerSession.outbound = null;
    }
}

module.exports.SessionStore = SessionStore;
