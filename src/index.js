'use strict';

const net = require('net');

const { current: log } = require('./logger');
const { Mesh } = require('./mesh');
const { BullyElection } = require('./bully');
const { SessionStore } = require('./session_store');

const peerName = parseInt(process.argv[2] || 0);
const peerNetwork = require('./peers.json');
const peerCurrent = peerNetwork[peerName];
const peerAddress = peerCurrent.address.split(':');

const peerSessions = new SessionStore();
const peerMesh = new Mesh(peerName, peerNetwork, peerSessions);
const peerElection = new BullyElection(peerMesh, peerSessions);

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
        peerElection.start();
    });

server.peer = peerCurrent;
