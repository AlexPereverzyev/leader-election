
# Leader Election

Distributed leader election algorithms for Node.js

## Algorithms

- Bully leader election:
https://www.cs.colostate.edu/%7Ecs551/CourseNotes/Synchronization/BullyExample.html

- Token ring leader election:
https://www.cs.colostate.edu/%7Ecs551/CourseNotes/Synchronization/RingElectExample.html

## How to run it?

Clone the repo and run `npm install` from the project's directory.

In 3 terminals run `npm start`, `npm start 1` and `npm start 2` correspondingly. This will start 3 peers and they will elect a leader with the highest ID - 2 (3rd peer).

Use `Ctrl+C` to shutdown or `npm start #` to start peers from terminals and observe standard output: election messages, connection retries, timeouts, active sessions, etc.

By default, bully election algorithm is used. Add the corresponding argument to switch to token ring: `npm start # ring`;

To add more peers, edit `src/peers.json`, but make sure peer name matches it's array index.

## How does it work?

There is an abstracted connectivity layer (`mesh.js`) over standard sockets that ensures peers are connected at all times. It reports network change events to the corresponding leader election algorithm implementation. Technically the mesh can be used for any other distributed algorithm implementation, eg: 2-phase commit or Paxos.

Leader election algorithm _tells_ the connectivity layer what peers to (re)connect and depending on the type of network event initiates leader election.

TCP sockets are chosen as communication protocol transport mostly because of neutrality. The peer communication messaging format is very lightweight: message ID and JSON payload (TLV-style).

## Pre-requisites

- each peer has unique name (index)
- each peer knows about the others
- peers addresses are static

## Implementation Notes

- peers with lower IDs initiate connections to peers with higher IDs (bully)
- peers initiate connections clockwise until they connect to the next peer (token ring)
- peer with highest ID is elected as leader
- peer is considered down when socket is closed or failed (no health checks)
- a few edge cases are handled, for example when single peers is up or peer joins the network with already elected leader

## Simplifications

- message parser is not srteaming: re-scans buffer every time the new chunk arrives
- optimistic message validation
- draining sockets ignored

## Bugs?

In case you have spotted a bug, please let me know :)
