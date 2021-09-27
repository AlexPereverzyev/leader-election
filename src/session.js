'use strict';

class Session {
    constructor() {
        this.ready = false;
        this.closed = false;
        this.inboundSock = null;
        this.inboundBuffer = Buffer.alloc(0);
        this.outboundSock = null;
        this.outboundBuffer = Buffer.alloc(0);
    }

    get inbound() {
        return this.inboundSock;
    }

    set inbound(socket) {
        this.inboundSock = socket;
        this.ready = this.inboundSock && this.outboundSock;
    }

    get inboundBuf() {
        return this.inboundBuffer;
    }

    set inboundBuf(buffer) {
        if (buffer) {
            this.inboundBuffer = buffer;
        } else {
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

    get outboundBuf() {
        return this.outboundBuffer;
    }

    set outboundBuf(buffer) {
        if (buffer) {
            this.outboundBuffer = buffer;
        } else {
            this.outboundBuffer = Buffer.alloc(0);
        }
    }
}

module.exports.Session = Session;
