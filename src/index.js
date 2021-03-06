'use strict';

const net = require('net');

const { current: log } = require('./logger');
const { Mesh } = require('./mesh');
const { SessionStore } = require('./session_store');
const { BullyElection } = require('./bully');
const { TokenRingElection } = require('./ring');

const peerName = parseInt(process.argv[2] || 0);
const peerNetwork = require('./peers.json');
const peerCurrent = peerNetwork[peerName];
const peerAddress = peerCurrent.address.split(':');
const peerSessions = new SessionStore();
const peerMesh = new Mesh(peerName, peerNetwork, peerSessions);

const Algorithm = {
    Bully: 'bully',
    TokenRing: 'ring',
};
const electionAlg = process.argv[3] || Algorithm.Bully;
const Election = electionAlg === Algorithm.TokenRing ? TokenRingElection : BullyElection;
const peerElection = new Election(peerMesh, peerSessions);

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
        log.info(`Peer with ${electionAlg} election started at ${peerAddress}`, server);
        log.info(`Peers known: ${JSON.stringify(peerNetwork.map((p) => p.name))}`, server);

        peerElection.start();
        peerMesh.connect();
    });

server.peer = peerCurrent;
