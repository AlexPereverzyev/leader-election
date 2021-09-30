const { expect } = require('chai');

const { Message, Messages, Separator } = require('../src/parser');

describe('MessageParser', () => {
    describe('parse', () => {
        it('should parse message when payload provided', () => {
            // Arrange
            const data = Buffer.from('test');
            const length = Buffer.allocUnsafe(4);
            length.writeUInt32LE(data.length);
            const msg = Buffer.from([Messages.Hello, Separator, ...length, Separator, ...data]);

            // Act
            const result = Message.parse(msg);

            // Assert
            expect(result).is.not.null;
            expect(result.type).is.equal(Messages.Hello);
            expect(result.data).is.equal('test');
        });
    });

    describe('build', () => {
        it('should build message when payload provided', () => {
            // Arrange
            const data = Buffer.from('test');
            const length = Buffer.allocUnsafe(4);
            length.writeUInt32LE(data.length);
            const msg = Buffer.from([Messages.Hello, Separator, ...length, Separator, ...data]);

            // Act
            const result = Message.build(Messages.Hello, 'test');

            // Assert
            expect(result).is.instanceOf(Buffer);
            expect(result.compare(msg)).is.equal(0);
        });
    });
});
