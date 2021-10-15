'use strict';

const { current: log } = require('./logger');
const { Session } = require('./session');

const SessionsLogInterval = 5 * 1000; // 5 sec

class SessionStore {
    constructor() {
        this.sessions = new Map();

        // report active sessions periodically
        setInterval(() => {
            const active = [];
            for (const session of this.sessions.values()) {
                if (session.ready) {
                    active.push(session);
                }
            }
            log.debug(
                `Active sessions: ${JSON.stringify(
                    active.sort((s1, _) => (s1.incoming ? -1 : 1)).map((s) => s.peer.name),
                )}`,
            );
        }, SessionsLogInterval);
    }

    [Symbol.iterator]() {
        return this.sessions.values();
    }

    get(peer) {
        return peer && peer.name !== undefined ? this.sessions.get(peer.name) : undefined;
    }

    start(peer, socket) {
        let session = this.sessions.get(peer.name);
        if (session) {
            session.socket = session.socket || socket;
            return session;
        }

        session = new Session(peer);
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
