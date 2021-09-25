'use strict';

class Session {
    constructor() {
        this.sessions = new Map();
    }

    startSession(peer) {
        let peerSession = this.sessions.get(peer.name);
        if (peerSession) {
            return peerSession;
        }

        peerSession = {
            ready: false,
            closed: false,
            outbound: null,
            inbound: null,
            inboundBuffer: Buffer.alloc(0),
        };

        this.sessions.set(peer.name, peerSession);
        return peerSession;
    }

    stopSession(peer) {
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

module.exports.Session = Session;
