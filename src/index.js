'use strict';

const net = require('net');
const { current: log } = require('./logger');
const { Mesh } = require('./mesh');

const peerName = parseInt(process.argv[2] || 0);
const peerNetwork = require('./peers.json');
const peerCurrent = peerNetwork[peerName];
const peerAddress = peerCurrent.address.split(':');

// todo: track sessions
// const { Session } = require('./session');
// const peerSessions = new Session()

const peerMesh = new Mesh(peerName, peerNetwork);

const server = net
    .createServer((socket) => {
        peerMesh.accept(socket);
    })
    .on('error', (err) => {
        log.error(`Peer failed: ${err.message}`, server);
        // todo: close all peer sessions

        server.close();
    })
    .listen(peerAddress[1], peerAddress[0], () => {
        log.info(`Peer started at ${peerAddress}`, server);
        log.info(`Peers known: ${JSON.stringify(peerNetwork)}`, server);

        setImmediate(() => {
            peerMesh.connect(peerNetwork.filter((p) => p.name !== peerName));
        });
    });

server.peer = peerCurrent;
