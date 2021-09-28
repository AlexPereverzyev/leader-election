'use strict';

const { timestamp } = require('./utils');

class Logger {
    constructor(level, backend) {
        this.level = level in LogLevels ? level : LogLevels.debug;
        this.backend = backend || console;

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
        const con = (context && context.id) || '******';
        const ctx = (context && context.peer) || context || {};
        const src = ctx.name !== undefined ? ctx.name : '?';
        return `[${now}]${LogLevelNames[level]}|${con}-${src}: ${message}`;
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
