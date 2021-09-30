
# Leader Election

Distributed leader election algorithms for Node.js

## Algorithms

- Bully leader election:
https://www.cs.colostate.edu/%7Ecs551/CourseNotes/Synchronization/BullyExample.html
- Token ring leader election **(pending)**:
https://www.cs.colostate.edu/%7Ecs551/CourseNotes/Synchronization/RingElectExample.html

## How to run it?

Clone the repo and run `npm install` from the project's directory.

In 3 terminals run `npm start`, `npm start 1` and `npm start 2` correspondingly. This will start 3 peers and they will elect a leader with the highest ID - 2 (3rd peer).

Use `Ctrl+C` to shutdown or `npm start #` to start peers from terminals and observe standard output: election messages, peer connection retries, timeouts, etc.

To add more peers, edit `src/peers.json`, but make sure peer name matches it's array index.

## Pre-requisites

- each peer has unique name (index)
- each peer knows about the others
- peers addresses are static

## Implementation Notes

- peers with lower IDs initiate connections to peers with higher IDs
- peer with highest ID is elected as leader
- peer is considered down when socket is closed or failed (no health checks)
- there are election timeouts to handle edge cases, particulary when peers join the network with elected leader

## Simplifications

- message parser is not srteaming: re-scans buffer every time the new chunk arrives
- optimistic message validation
- draining sockets ignored

## TODO

- add more tests
- implement token ring election