import { DIR } from "./constants.js";

export function createInitialState() {
  return {
    rows: 7,
    cols: 7,

    ship: {
      x: 3,
      y: 3,
      dir: DIR.N,
      hp: 6,
      ammo: 15,
    },

    blocked: [
      [2, 0]
    ],

    // highlight of previous tile
    prev: { x: 3, y: 3 },

    // queued action from any input adapter
    // { type: "move", move: "F"|"L"|"R" }
    // { type: "shoot" }
    queuedAction: null,

    // rendering-only ephemeral
    projectiles: [], // {fromX,fromY,toX,toY,spawnTime,durationMs}
    lastDamageAt: 0,
  };
}

export function cloneState(s) {
  // minimal structured clone to keep core deterministic and safe
  return {
    ...s,
    ship: { ...s.ship },
    prev: { ...s.prev },
    blocked: s.blocked.map(p => [p[0], p[1]]),
    queuedAction: s.queuedAction ? { ...s.queuedAction } : null,
    projectiles: s.projectiles.map(p => ({ ...p })),
  };
}
