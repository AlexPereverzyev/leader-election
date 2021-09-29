'use strict';

class Session {
    constructor() {
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

        if (!socket) {
            this.buf = Buffer.alloc(0);
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

    send(msg) {
        if (!this.ready) {
            return false;
        }
        if (this.sock && this.sock.writeable) {
            return this.sock.write(msg);
        }
        return false;
    }

    close() {
        this.socket = null;
        this.closed = true;
    }
}

module.exports.Session = Session;
