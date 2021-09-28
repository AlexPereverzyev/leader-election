'use strict';

class Session {
    constructor() {
        this.ready = false;
        this.closed = false;
        this.inboundSocket = null;
        this.inboundBuffer = Buffer.alloc(0);
        this.outboundSocket = null;
        this.outboundBuffer = Buffer.alloc(0);
    }

    get inboundSock() {
        return this.inboundSocket;
    }

    set inboundSock(socket) {
        this.inboundSocket = socket;
        this.ready = this.inboundSocket && this.outboundSocket;
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

    get outboundSock() {
        return this.outboundSocket;
    }

    set outboundSock(socket) {
        this.outboundSocket = socket;
        this.ready = this.inboundSocket && this.outboundSocket;

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

    send(msg) {
        if (!this.ready) {
            return false;
        }
        if (this.inboundSocket && this.inboundSocket.writeable) {
            this.inboundSocket.write(msg);
            return;
        }
        if (this.outboundSocket && this.outboundSocket.writeable) {
            this.outboundSocket.write(msg);
        }
    }
}

module.exports.Session = Session;
