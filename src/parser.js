'use strict';

const SEP = 0x3a; // ':'

class Message {
    static parse(buffer) {
        let type;
        let data;
        let length;
        let l = 0;
        let hasData = false;

        for (let i = 0; i < buffer.length; i++) {
            if (buffer[i] !== SEP) {
                continue;
            }

            if (!type) {
                type = buffer.readUInt8(l);
                if (!(type in Messages)) {
                    type = null;
                    break;
                }
                if (!(hasData = type === Messages.Data || type === Messages.Hello)) {
                    break;
                }
                l = i + 1;
                continue;
            }

            if (!length) {
                length = buffer.readUInt32LE(l);
                if (!length) {
                    break;
                }
                l = i + 1;
                if (l + length > buffer.length) {
                    break;
                }
                data = buffer.slice(l, l + length).toString();
                l = l + length;
                break;
            }
        }

        if (!(type && (data || !hasData))) {
            return null;
        }

        return {
            type,
            data,
            tail: l < buffer.length ? buffer.slice(l) : undefined,
        };
    }

    static build(type, data = null) {
        const length = 2 + (data ? 5 + data.length : 0);
        const buffer = Buffer.allocUnsafe(length);

        buffer.writeUInt8(type, 0);
        buffer.writeUInt8(SEP, 1);

        if (data) {
            buffer.writeUInt32LE(data.length, 2);
            buffer.writeUInt8(SEP, 6);
            Buffer.from(data).copy(buffer, 7);
        }

        return buffer;
    }
}

const Messages = {
    Hello: 1,
    Bye: 2,
    Election: 11,
    Leader: 12,
    Data: 21,
};

Object.keys(Messages).forEach((k) => (Messages[Messages[k]] = k));

module.exports.Message = Message;
module.exports.Messages = Messages;
module.exports.Separator = SEP;
