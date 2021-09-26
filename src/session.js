'use strict';

// todo: add socket close routines and update mesh

class Session {
    constructor() {
        this.ready = false;
        this.closed = false;
        this.outboundSock = null;
        this.outboundBuffer = Buffer.alloc(0);
        this.inboundSock = null;
        this.inboundBuffer = Buffer.alloc(0);
    }

    get inbound() {
        return this.inboundSock;
    }

    set inbound(socket) {
        this.inboundSock = socket;
        this.ready = this.inboundSock && this.outboundSock;

        if (!socket) {
            this.inboundBuffer = Buffer.alloc(0);
        }
    }

    get outbound() {
        return this.outboundSock;
    }

    set outbound(socket) {
        this.outboundSock = socket;
        this.ready = this.inboundSock && this.outboundSock;

        if (!socket) {
            this.outboundBuffer = Buffer.alloc(0);
        }
    }
}

module.exports.Session = Session;
