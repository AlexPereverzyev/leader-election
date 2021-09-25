const { expect } = require('chai');
const { createStubInstance } = require('sinon');

describe('handlers', () => {
    describe('GenericHandler', () => {
        function setup() {
            const stub = createStubInstance(String);

            const subject = {};

            return {
                subject,
                stub,
            };
        }

        it('should work fine when ever', () => {
            // Arrange
            const test = setup();

            // Act
            test.stub.toString();

            // Assert
            expect(test.stub.toString.calledOnce).is.true;
        });
    });
});
