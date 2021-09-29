'use strict';

const { timestamp } = require('./utils');

class Logger {
    constructor(level, backend = console, peerName) {
        this.level = level in LogLevels ? level : LogLevels.debug;
        this.backend = backend || console;
        this.peerName = peerName || parseInt(process.argv[2] || 0);

        Object.keys(LogLevels).forEach(
            (l) =>
                (this[l] = (m, c) => {
                    if (this.level >= LogLevels[l]) {
                        this.backend[l](this.format(m, c, l));
                    }
                }),
        );
    }

    format(message, context, level) {
        const now = timestamp();
        const ctx = (context && context.peer) || context || {};
        const src = ctx.name !== undefined ? ctx.name : '?';
        return `[${now}]${LogLevelNames[level]}|${this.peerName}-${src}: ${message}`;
    }
}

const LogLevelNames = {
    error: 'err',
    warn: 'wrn',
    info: 'inf',
    debug: 'dbg',
};

const LogLevels = {
    none: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
};

module.exports = {
    current: new Logger(),
    LogLevels,
    Logger,
};
