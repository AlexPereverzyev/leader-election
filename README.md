
# [WIP]

# Leader Election

Distributed leader election algoritms for Node.js


## Algorithms

- Bully leader election (in progress):
https://www.cs.colostate.edu/%7Ecs551/CourseNotes/Synchronization/BullyExample.html
- Token ring leader election (pending):
https://www.cs.colostate.edu/%7Ecs551/CourseNotes/Synchronization/RingElectExample.html

## Assumtions

- each peer has unique name (index)
- each peer knows about the others
- peers addresses do not change

## Simplifications

- protocol is sequential: no message ids and pipelining
- message parser is not srteaming: re-scans buffer every time new chunk arrives
- peers maintain two connections: no need to prune the second one
- no ping-ponging: node is down when any of the two connections is lost
- optimistic message validation
