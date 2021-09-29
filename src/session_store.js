'use strict';

const { Session } = require('./session');

class SessionStore {
    constructor() {
        this.sessions = new Map();
    }

    get(peer) {
        return peer && peer.name !== undefined ? this.sessions.get(peer.name) : undefined;
    }

    start(peer, socket) {
        let session = this.sessions.get(peer.name);
        if (session) {
            return session;
        }

        session = new Session();
        session.socket = socket;

        this.sessions.set(peer.name, session);
        return session;
    }

    stop(peer) {
        const session = this.sessions.get(peer.name);
        if (!session) {
            return;
        }
        if (session.closed) {
            return;
        }

        session.close();
        this.sessions.delete(peer.name);
    }
}

module.exports.SessionStore = SessionStore;
