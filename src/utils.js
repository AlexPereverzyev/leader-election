'use strict';

module.exports.timestamp = function () {
    return (new Date() / 1000) | 0;
};

module.exports.id = function () {
    return Math.random().toString(36).substr(-6);
};
