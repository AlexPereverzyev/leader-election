'use strict';

class Session {
    constructor(peer) {
        this.peer = peer;
        this.ready = false;
        this.closed = false;
        this.sock = null;
        this.buf = Buffer.alloc(0);
    }

    get socket() {
        return this.sock;
    }

    set socket(socket) {
        this.sock = socket;
        this.ready = !!this.sock;
        this.buf = Buffer.alloc(0);

        if (this.sock) {
            this.incoming = this.sock.incoming;
            this.outgoing = this.sock.outgoing;
        }
    }

    get buffer() {
        return this.buf;
    }

    set buffer(value) {
        if (value) {
            this.buf = value;
        } else {
            this.buf = Buffer.alloc(0);
        }
    }

    send(msg, callback = () => {}) {
        if (!this.ready) {
            return false;
        }
        if (this.sock && this.sock.writable) {
            return this.sock.write(msg, callback);
        }
        return false;
    }

    close() {
        this.socket = null;
        this.closed = true;
    }
}

module.exports.Session = Session;
