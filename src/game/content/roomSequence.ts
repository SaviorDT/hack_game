export const ACTIVE_ROOM_IDS: readonly string[] = [
  "tutorial1",
  "tutorial2",
  "tutorial3",
  "tutorial4",
  "tutorial5",
  "storage",
  "yard",
  "lane",
  "gate",
  "room",
  "arena",
]

export const UNUSED_ROOM_IDS: readonly string[] = [
  "wheel",
]

export const ROOM_CONTENT_SNAPSHOT: Readonly<Record<string, unknown>> = {
  "tutorial1": {
    "id": "tutorial1",
    "hint": "Move with WASD. Walk over the dagger to pick it up, then attack with SPACE. Defeat the training dummy to open the exit, then walk into it.",
    "goal": "Defeat the dummy, then walk into the exit.",
    "objects": [
      {
        "id": "player",
        "role": "player",
        "name": "hacker",
        "x": 250,
        "y": 420,
        "displayWidth": 94,
        "displayHeight": 94,
        "scaleX": 0.53,
        "scaleY": 0.53,
        "speed": {
          "acceleration": 4000,
          "frictionAcceleration": 3000,
          "turnaroundAcceleration": 10000,
          "maxSpeed": 500
        },
        "maxHealth": 100,
        "colliderWidth": 50,
        "colliderHeight": 71
      },
      {
        "id": "tutorial1dagger",
        "role": "weapon",
        "name": "dagger",
        "x": 640,
        "y": 560,
        "displayWidth": 49,
        "displayHeight": 49,
        "scaleX": 0.68,
        "scaleY": 0.68,
        "attackDistance": 30,
        "attackDurationMs": 200,
        "holdOffsetX": 20,
        "holdOffsetY": 26
      },
      {
        "id": "dummy",
        "role": "enemy",
        "name": "dummy",
        "passive": true,
        "x": 1250,
        "y": 420,
        "displayWidth": 176,
        "displayHeight": 176,
        "scaleX": 1,
        "scaleY": 1,
        "speed": 0,
        "maxHealth": 60,
        "colliderWidth": 110,
        "colliderHeight": 160,
        "mass": 1000
      }
    ],
    "exit": {
      "targetRoomId": "tutorial2",
      "label": "tutorial2",
      "requires": {
        "kind": "defeat",
        "objectIds": [
          "dummy"
        ]
      },
      "endsGame": false
    }
  },
  "tutorial2": {
    "id": "tutorial2",
    "hint": "type: acc dagger guard",
    "goal": "Defeat the guard. Try throwing the dagger with acc.",
    "objects": [
      {
        "id": "tutorial2dagger",
        "name": "dagger",
        "role": "weapon",
        "x": 420,
        "y": 600,
        "displayWidth": 49,
        "displayHeight": 49,
        "scaleX": 0.68,
        "scaleY": 0.68,
        "prefabId": "dagger",
        "colliderWidth": 72,
        "colliderHeight": 72,
        "colliderShape": "box",
        "attackDistance": 30,
        "attackDurationMs": 200,
        "holdOffsetX": 20,
        "holdOffsetY": 26
      },
      {
        "id": "tutorial2boulder",
        "name": "boulder",
        "role": "object",
        "x": 760,
        "y": 300,
        "displayWidth": 154,
        "displayHeight": 154,
        "scaleX": 1.28,
        "scaleY": 1.28,
        "prefabId": "boulder",
        "colliderWidth": 128,
        "colliderHeight": 128,
        "colliderShape": "circle",
        "mass": 100
      },
      {
        "id": "sentry",
        "name": "guard",
        "role": "enemy",
        "x": 1500,
        "y": 420,
        "displayWidth": 176,
        "displayHeight": 176,
        "scaleX": 1,
        "scaleY": 1,
        "prefabId": "guard",
        "colliderWidth": 110,
        "colliderHeight": 160,
        "colliderShape": "box",
        "maxHealth": 30,
        "speed": 0,
        "mass": 1000
      }
    ],
    "exit": {
      "targetRoomId": "tutorial3",
      "label": "tutorial3",
      "requires": {
        "kind": "defeat",
        "objectIds": [
          "sentry"
        ]
      },
      "endsGame": false
    }
  },
  "tutorial3": {
    "id": "tutorial3",
    "hint": "<Hold 8,9,0> record command",
    "goal": "Defeat the fast guard.",
    "objects": [
      {
        "id": "tutorial3dagger",
        "name": "dagger",
        "role": "weapon",
        "x": 430,
        "y": 600,
        "displayWidth": 49,
        "displayHeight": 49,
        "scaleX": 0.68,
        "scaleY": 0.68,
        "prefabId": "dagger",
        "colliderWidth": 72,
        "colliderHeight": 72,
        "colliderShape": "box",
        "attackDistance": 30,
        "attackDurationMs": 200,
        "holdOffsetX": 20,
        "holdOffsetY": 26
      },
      {
        "id": "runner",
        "name": "guard",
        "role": "enemy",
        "x": 1550,
        "y": 420,
        "displayWidth": 176,
        "displayHeight": 176,
        "scaleX": 1,
        "scaleY": 1,
        "prefabId": "guard",
        "colliderWidth": 110,
        "colliderHeight": 160,
        "colliderShape": "box",
        "maxHealth": 30,
        "speed": 380
      }
    ],
    "exit": {
      "targetRoomId": "tutorial4",
      "label": "tutorial4",
      "requires": {
        "kind": "defeat",
        "objectIds": [
          "runner"
        ]
      },
      "endsGame": false
    }
  },
  "tutorial4": {
    "id": "tutorial4",
    "hint": "move your mouse and type: acc boulder $mouse",
    "goal": "Get through to the far side.",
    "objects": [
      {
        "id": "tutorial4boulder",
        "role": "object",
        "name": "boulder",
        "x": 910,
        "y": 400,
        "displayWidth": 154,
        "displayHeight": 154,
        "scaleX": 1.28,
        "scaleY": 1.28,
        "colliderWidth": 128,
        "colliderHeight": 128,
        "colliderShape": "circle",
        "mass": 100
      }
    ],
    "walls": [
      {
        "x": 910,
        "y": 205,
        "width": 60,
        "height": 250
      },
      {
        "x": 910,
        "y": 585,
        "width": 60,
        "height": 230
      }
    ],
    "exit": {
      "targetRoomId": "tutorial5",
      "label": "tutorial5",
      "endsGame": false
    }
  },
  "storage": {
    "id": "storage",
    "goal": "The way on is shut tight.",
    "objects": [
      {
        "id": "storagecrate",
        "role": "object",
        "name": "crate",
        "kind": "crate",
        "x": 520,
        "y": 260,
        "displayWidth": 88,
        "displayHeight": 88,
        "scaleX": 1,
        "scaleY": 1,
        "colliderWidth": 80,
        "colliderHeight": 80,
        "mass": 3
      },
      {
        "id": "storagecrate2",
        "role": "object",
        "name": "crate2",
        "kind": "crate",
        "x": 760,
        "y": 600,
        "displayWidth": 88,
        "displayHeight": 88,
        "scaleX": 1,
        "scaleY": 1,
        "colliderWidth": 80,
        "colliderHeight": 80,
        "mass": 3
      },
      {
        "id": "storageplate",
        "role": "object",
        "name": "plate",
        "kind": "plate",
        "x": 1500,
        "y": 560,
        "displayWidth": 96,
        "displayHeight": 96,
        "scaleX": 1,
        "scaleY": 1,
        "colliderWidth": 80,
        "colliderHeight": 80
      }
    ],
    "walls": [
      {
        "x": 1130,
        "y": 205,
        "width": 60,
        "height": 250
      },
      {
        "x": 730,
        "y": 495,
        "width": 340,
        "height": 50
      }
    ],
    "exit": {
      "targetRoomId": "yard",
      "label": "yard",
      "requires": {
        "kind": "pressed",
        "plateIds": [
          "storageplate"
        ]
      },
      "endsGame": false
    }
  },
  "yard": {
    "id": "yard",
    "goal": "Deal with the archer.",
    "objects": [
      {
        "id": "yarddagger",
        "name": "dagger",
        "role": "weapon",
        "x": 430,
        "y": 600,
        "displayWidth": 49,
        "displayHeight": 49,
        "scaleX": 0.68,
        "scaleY": 0.68,
        "prefabId": "dagger",
        "colliderWidth": 72,
        "colliderHeight": 72,
        "colliderShape": "box",
        "attackDistance": 30,
        "attackDurationMs": 200,
        "holdOffsetX": 20,
        "holdOffsetY": 26
      },
      {
        "id": "yardcrate",
        "name": "crate",
        "role": "object",
        "x": 830,
        "y": 420,
        "displayWidth": 88,
        "displayHeight": 88,
        "scaleX": 1,
        "scaleY": 1,
        "prefabId": "crate",
        "kind": "crate",
        "colliderWidth": 80,
        "colliderHeight": 80,
        "colliderShape": "box",
        "mass": 3
      },
      {
        "id": "yardarcher",
        "name": "archer",
        "role": "enemy",
        "x": 1620,
        "y": 420,
        "displayWidth": 176,
        "displayHeight": 176,
        "scaleX": 1,
        "scaleY": 1,
        "prefabId": "archer",
        "kind": "archer",
        "colliderWidth": 110,
        "colliderHeight": 160,
        "colliderShape": "box",
        "maxHealth": 30,
        "speed": 0,
        "mass": 1000
      }
    ],
    "walls": [
      {
        "x": 660,
        "y": 260,
        "width": 80,
        "height": 80
      },
      {
        "x": 660,
        "y": 560,
        "width": 80,
        "height": 80
      },
      {
        "x": 1020,
        "y": 410,
        "width": 80,
        "height": 80
      },
      {
        "x": 1340,
        "y": 260,
        "width": 80,
        "height": 80
      },
      {
        "x": 1340,
        "y": 560,
        "width": 80,
        "height": 80
      }
    ],
    "exit": {
      "targetRoomId": "lane",
      "label": "lane",
      "requires": {
        "kind": "defeat",
        "objectIds": [
          "yardarcher"
        ]
      },
      "endsGame": false
    }
  },
  "lane": {
    "id": "lane",
    "goal": "The way on is shut tight, and the archer has the plate covered.",
    "objects": [
      {
        "id": "laneboulder",
        "name": "boulder",
        "role": "object",
        "x": 450,
        "y": 580,
        "displayWidth": 154,
        "displayHeight": 154,
        "scaleX": 1.28,
        "scaleY": 1.28,
        "prefabId": "boulder",
        "colliderWidth": 128,
        "colliderHeight": 128,
        "colliderShape": "circle",
        "mass": 100
      },
      {
        "id": "laneplate",
        "name": "plate",
        "role": "object",
        "x": 1505,
        "y": 345,
        "displayWidth": 96,
        "displayHeight": 96,
        "scaleX": 1,
        "scaleY": 1,
        "prefabId": "plate",
        "kind": "plate",
        "colliderWidth": 80,
        "colliderHeight": 80,
        "colliderShape": "box"
      },
      {
        "id": "lanearcher",
        "name": "archer",
        "role": "enemy",
        "x": 1505,
        "y": 155,
        "displayWidth": 106,
        "displayHeight": 106,
        "scaleX": 0.6,
        "scaleY": 0.6,
        "prefabId": "archer",
        "kind": "archer",
        "colliderWidth": 66,
        "colliderHeight": 96,
        "colliderShape": "box",
        "maxHealth": 30,
        "speed": 0,
        "mass": 1000
      }
    ],
    "walls": [
      {
        "x": 1400,
        "y": 175,
        "width": 40,
        "height": 190
      },
      {
        "x": 1425,
        "y": 250,
        "width": 90,
        "height": 40
      },
      {
        "x": 1682,
        "y": 250,
        "width": 284,
        "height": 40
      }
    ],
    "exit": {
      "targetRoomId": "gate",
      "label": "gate",
      "requires": {
        "kind": "pressed",
        "plateIds": [
          "laneplate"
        ]
      },
      "endsGame": false
    }
  },
  "gate": {
    "id": "gate",
    "goal": "Hold the plate down and defeat the guards.",
    "objects": [
      {
        "id": "gatedagger",
        "name": "dagger",
        "role": "weapon",
        "x": 370,
        "y": 600,
        "displayWidth": 49,
        "displayHeight": 49,
        "scaleX": 0.68,
        "scaleY": 0.68,
        "prefabId": "dagger",
        "colliderWidth": 72,
        "colliderHeight": 72,
        "colliderShape": "box",
        "attackDistance": 30,
        "attackDurationMs": 200,
        "holdOffsetX": 20,
        "holdOffsetY": 26
      },
      {
        "id": "gatecrate",
        "name": "crate",
        "role": "object",
        "x": 560,
        "y": 420,
        "displayWidth": 88,
        "displayHeight": 88,
        "scaleX": 1,
        "scaleY": 1,
        "prefabId": "crate",
        "kind": "crate",
        "colliderWidth": 80,
        "colliderHeight": 80,
        "colliderShape": "box",
        "mass": 3
      },
      {
        "id": "gateboulder",
        "name": "boulder",
        "role": "object",
        "x": 570,
        "y": 630,
        "displayWidth": 154,
        "displayHeight": 154,
        "scaleX": 1.28,
        "scaleY": 1.28,
        "prefabId": "boulder",
        "colliderWidth": 128,
        "colliderHeight": 128,
        "colliderShape": "circle",
        "mass": 100
      },
      {
        "id": "gateplate",
        "name": "plate",
        "role": "object",
        "x": 1560,
        "y": 600,
        "displayWidth": 96,
        "displayHeight": 96,
        "scaleX": 1,
        "scaleY": 1,
        "prefabId": "plate",
        "kind": "plate",
        "colliderWidth": 80,
        "colliderHeight": 80,
        "colliderShape": "box"
      },
      {
        "id": "gateguard",
        "name": "guard",
        "role": "enemy",
        "x": 1450,
        "y": 300,
        "displayWidth": 176,
        "displayHeight": 176,
        "scaleX": 1,
        "scaleY": 1,
        "prefabId": "guard",
        "colliderWidth": 110,
        "colliderHeight": 160,
        "colliderShape": "box",
        "maxHealth": 60,
        "speed": 190
      },
      {
        "id": "gateguard2",
        "name": "guard2",
        "role": "enemy",
        "x": 1480,
        "y": 470,
        "displayWidth": 176,
        "displayHeight": 176,
        "scaleX": 1,
        "scaleY": 1,
        "prefabId": "guard",
        "colliderWidth": 110,
        "colliderHeight": 160,
        "colliderShape": "box",
        "maxHealth": 60,
        "speed": 120
      },
      {
        "id": "gatearcher",
        "name": "archer",
        "role": "enemy",
        "x": 1700,
        "y": 200,
        "displayWidth": 176,
        "displayHeight": 176,
        "scaleX": 1,
        "scaleY": 1,
        "prefabId": "archer",
        "kind": "archer",
        "colliderWidth": 110,
        "colliderHeight": 160,
        "colliderShape": "box",
        "maxHealth": 30,
        "speed": 0,
        "mass": 1000
      }
    ],
    "walls": [
      {
        "x": 730,
        "y": 270,
        "width": 60,
        "height": 140
      },
      {
        "x": 730,
        "y": 570,
        "width": 60,
        "height": 140
      },
      {
        "x": 1285,
        "y": 415,
        "width": 110,
        "height": 110
      }
    ],
    "exit": {
      "targetRoomId": "room",
      "label": "room",
      "requires": [
        {
          "kind": "pressed",
          "plateIds": [
            "gateplate"
          ]
        },
        {
          "kind": "defeat",
          "objectIds": [
            "gateguard",
            "gateguard2"
          ]
        }
      ],
      "endsGame": false
    }
  },
  "room": {
    "id": "room",
    "hint": "The real thing: guards rush you once you cross the middle of the room. Use acc and your dagger to reach the next room.",
    "goal": "Reach the exit to the next room.",
    "objects": [
      {
        "id": "player",
        "role": "player",
        "name": "hacker",
        "x": 250,
        "y": 420,
        "displayWidth": 94,
        "displayHeight": 94,
        "scaleX": 0.53,
        "scaleY": 0.53,
        "speed": {
          "acceleration": 4000,
          "frictionAcceleration": 3000,
          "turnaroundAcceleration": 10000,
          "maxSpeed": 500
        },
        "maxHealth": 100,
        "colliderWidth": 50,
        "colliderHeight": 71
      },
      {
        "id": "boulder",
        "role": "object",
        "name": "boulder",
        "x": 800,
        "y": 280,
        "displayWidth": 154,
        "displayHeight": 154,
        "scaleX": 1.28,
        "scaleY": 1.28,
        "colliderWidth": 128,
        "colliderHeight": 128,
        "colliderShape": "circle",
        "mass": 100
      },
      {
        "id": "dagger",
        "role": "weapon",
        "name": "dagger",
        "x": 614,
        "y": 611,
        "displayWidth": 49,
        "displayHeight": 49,
        "scaleX": 0.68,
        "scaleY": 0.68,
        "attackDistance": 30,
        "attackDurationMs": 200,
        "holdOffsetX": 20,
        "holdOffsetY": 26
      },
      {
        "id": "guard",
        "role": "enemy",
        "name": "guard",
        "strikeDamage": 40,
        "x": 1558,
        "y": 422,
        "displayWidth": 176,
        "displayHeight": 176,
        "scaleX": 1,
        "scaleY": 1,
        "speed": 210,
        "maxHealth": 100,
        "colliderWidth": 110,
        "colliderHeight": 160
      },
      {
        "id": "guard2",
        "role": "enemy",
        "name": "guard2",
        "strikeDamage": 40,
        "x": 1277,
        "y": 205,
        "displayWidth": 176,
        "displayHeight": 176,
        "scaleX": 1,
        "scaleY": 1,
        "speed": 210,
        "maxHealth": 100,
        "colliderWidth": 110,
        "colliderHeight": 160
      },
      {
        "id": "guard3",
        "role": "enemy",
        "name": "guard3",
        "strikeDamage": 40,
        "x": 1221,
        "y": 563,
        "displayWidth": 176,
        "displayHeight": 176,
        "scaleX": 1,
        "scaleY": 1,
        "speed": 210,
        "maxHealth": 100,
        "colliderWidth": 110,
        "colliderHeight": 160
      }
    ],
    "exit": {
      "targetRoomId": "arena",
      "label": "arena",
      "endsGame": false
    }
  },
  "arena": {
    "id": "arena",
    "goal": "Defeat the warden, then walk into the exit.",
    "objects": [
      {
        "id": "arenaexcalibur",
        "name": "excalibur",
        "role": "weapon",
        "x": 360,
        "y": 600,
        "displayWidth": 49,
        "displayHeight": 49,
        "scaleX": 0.68,
        "scaleY": 0.68,
        "prefabId": "dagger",
        "colliderWidth": 72,
        "colliderHeight": 72,
        "colliderShape": "box",
        "attackDistance": 30,
        "attackDurationMs": 200,
        "holdOffsetX": 20,
        "holdOffsetY": 26
      },
      {
        "id": "warden",
        "name": "warden",
        "role": "enemy",
        "x": 1500,
        "y": 365,
        "displayWidth": 264,
        "displayHeight": 264,
        "scaleX": 1,
        "scaleY": 1,
        "prefabId": "boss",
        "colliderWidth": 165,
        "colliderHeight": 240,
        "colliderShape": "box",
        "maxHealth": 300,
        "speed": 200,
        "kind": "boss",
        "strikeDamage": 40,
        "mass": 1000
      },
      {
        "id": "arenat",
        "name": "t",
        "role": "object",
        "x": 960,
        "y": 120,
        "displayWidth": 96,
        "displayHeight": 96,
        "scaleX": 1,
        "scaleY": 1,
        "prefabId": "plate",
        "kind": "plate",
        "colliderWidth": 80,
        "colliderHeight": 80,
        "colliderShape": "box"
      },
      {
        "id": "arenatr",
        "name": "tr",
        "role": "object",
        "x": 1784,
        "y": 120,
        "displayWidth": 96,
        "displayHeight": 96,
        "scaleX": 1,
        "scaleY": 1,
        "prefabId": "plate",
        "kind": "plate",
        "colliderWidth": 80,
        "colliderHeight": 80,
        "colliderShape": "box"
      },
      {
        "id": "arenar",
        "name": "r",
        "role": "object",
        "x": 1784,
        "y": 390,
        "displayWidth": 96,
        "displayHeight": 96,
        "scaleX": 1,
        "scaleY": 1,
        "prefabId": "plate",
        "kind": "plate",
        "colliderWidth": 80,
        "colliderHeight": 80,
        "colliderShape": "box"
      },
      {
        "id": "arenabr",
        "name": "br",
        "role": "object",
        "x": 1784,
        "y": 660,
        "displayWidth": 96,
        "displayHeight": 96,
        "scaleX": 1,
        "scaleY": 1,
        "prefabId": "plate",
        "kind": "plate",
        "colliderWidth": 80,
        "colliderHeight": 80,
        "colliderShape": "box"
      },
      {
        "id": "arenab",
        "name": "b",
        "role": "object",
        "x": 960,
        "y": 660,
        "displayWidth": 96,
        "displayHeight": 96,
        "scaleX": 1,
        "scaleY": 1,
        "prefabId": "plate",
        "kind": "plate",
        "colliderWidth": 80,
        "colliderHeight": 80,
        "colliderShape": "box"
      },
      {
        "id": "arenabl",
        "name": "bl",
        "role": "object",
        "x": 136,
        "y": 660,
        "displayWidth": 96,
        "displayHeight": 96,
        "scaleX": 1,
        "scaleY": 1,
        "prefabId": "plate",
        "kind": "plate",
        "colliderWidth": 80,
        "colliderHeight": 80,
        "colliderShape": "box"
      },
      {
        "id": "arenal",
        "name": "l",
        "role": "object",
        "x": 136,
        "y": 390,
        "displayWidth": 96,
        "displayHeight": 96,
        "scaleX": 1,
        "scaleY": 1,
        "prefabId": "plate",
        "kind": "plate",
        "colliderWidth": 80,
        "colliderHeight": 80,
        "colliderShape": "box"
      },
      {
        "id": "arenatl",
        "name": "tl",
        "role": "object",
        "x": 136,
        "y": 120,
        "displayWidth": 96,
        "displayHeight": 96,
        "scaleX": 1,
        "scaleY": 1,
        "prefabId": "plate",
        "kind": "plate",
        "colliderWidth": 80,
        "colliderHeight": 80,
        "colliderShape": "box"
      }
    ],
    "exit": {
      "targetRoomId": "end",
      "label": "end",
      "requires": {
        "kind": "defeat",
        "objectIds": [
          "warden"
        ]
      },
      "endsGame": true
    }
  },
  "wheel": {
    "id": "wheel",
    "hint": "One throw won't be enough. Maybe you can make the dagger fly around with you?",
    "goal": "Defeat the dummy, then walk into the exit.",
    "objects": [
      {
        "id": "wheeldagger",
        "role": "weapon",
        "name": "dagger",
        "x": 614,
        "y": 611,
        "displayWidth": 49,
        "displayHeight": 49,
        "scaleX": 0.68,
        "scaleY": 0.68,
        "attackDistance": 30,
        "attackDurationMs": 200,
        "holdOffsetX": 20,
        "holdOffsetY": 26
      },
      {
        "id": "dummy2",
        "role": "object",
        "name": "dummy",
        "kind": "dummy",
        "x": 1490,
        "y": 365,
        "displayWidth": 176,
        "displayHeight": 176,
        "scaleX": 1,
        "scaleY": 1,
        "maxHealth": 200,
        "colliderWidth": 110,
        "colliderHeight": 160
      }
    ],
    "exit": {
      "targetRoomId": "storage",
      "label": "storage",
      "requires": {
        "kind": "defeat",
        "objectIds": [
          "dummy2"
        ]
      }
    }
  }
}
