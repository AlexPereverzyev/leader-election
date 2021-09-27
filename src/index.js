'use strict';

const net = require('net');
const { current: log } = require('./logger');
const { QuorumState } = require('./quorum_state');
const { Mesh } = require('./mesh');

const peerName = parseInt(process.argv[2] || 0);
const peerNetwork = require('./peers.json');
const peerCurrent = peerNetwork[peerName];
const peerAddress = peerCurrent.address.split(':');
const peerSessions = new QuorumState();
const peerMesh = new Mesh(peerName, peerNetwork, peerSessions);

const server = net
    .createServer((socket) => {
        peerMesh.accept(socket);
    })
    .on('error', (err) => {
        log.error(`Peer failed: ${err.message}`, server);

        peerMesh.disconnect();
        server.close();
    })
    .listen(peerAddress[1], peerAddress[0], () => {
        log.info(`Peer started at ${peerAddress}`, server);
        log.info(`Peers known: ${JSON.stringify(peerNetwork)}`, server);

        peerMesh.connect();
    });

server.peer = peerCurrent;
