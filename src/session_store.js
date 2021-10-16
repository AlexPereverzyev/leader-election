'use strict';

const { current: log } = require('./logger');
const { Session } = require('./session');

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
        }, 5 * 1000);
    }

    [Symbol.iterator]() {
        return this.sessions.values();
    }

    isReady(peer) {
        const session = this.get(peer);
        return session && session.ready;
    }

    get(peer) {
        return peer && peer.name !== undefined ? this.sessions.get(peer.name) : undefined;
    }

    getFirst(direction = Direction.Incoming) {
        for (const session of this) {
            if (session[direction] && session.ready) {
                return session;
            }
        }
    }

    getAny() {
        let session = this.getFirst(Direction.Outgoing);
        if (!session) {
            session = this.getFirst(Direction.Incoming);
        }
        return session;
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

const Direction = {
    Incoming: 'incoming',
    Outgoing: 'outgoing',
};

module.exports.SessionStore = SessionStore;
module.exports.Direction = Direction;
