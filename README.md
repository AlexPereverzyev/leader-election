
# [WIP]

# Leader Election

Distributed leader election algorithms for Node.js

## Algorithms

- Bully leader election (in progress):
https://www.cs.colostate.edu/%7Ecs551/CourseNotes/Synchronization/BullyExample.html
- Token ring leader election (pending):
https://www.cs.colostate.edu/%7Ecs551/CourseNotes/Synchronization/RingElectExample.html

## Pre-requisites

- each peer has unique name (index)
- each peer knows about the others
- peers addresses are static

## Implementation

- peers with lower IDs initiate connections to peers with higher IDs
- peer with highest ID is elected as leader
- peer is considered down when socket is closed or failed (no health checks)

## Simplifications

- message parser is not srteaming: re-scans buffer every time the new chunk arrives
- optimistic message validation
- draining sockets ignored
