'use strict';

const { Session } = require('./session');

class SessionState {
    constructor() {
        this.sessions = new Map();
    }

    get(peer) {
        return peer && peer.name ? this.sessions.get(peer.name) : undefined;
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
        const peerSession = this.sessions.get(peer.name);
        if (!peerSession) {
            return;
        }
        if (peerSession.closed) {
            return;
        }

        peerSession.closed = true;

        if (peerSession.inbound) {
            // todo: close socket
            peerSession.inboundBuffer = Buffer.alloc(0);
        }

        if (peerSession.outbound) {
            // todo: close socket
        }
    }
}

module.exports.SessionState = SessionState;
