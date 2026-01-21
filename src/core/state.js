import { DIR } from "./constants.js";

export function createInitialState(mapDef) {
  if (mapDef) {
    return {
      rows: mapDef.grid.rows,
      cols: mapDef.grid.cols,
      mapId: mapDef.id,
      mapSeed: mapDef.seed,
      ship: { ...mapDef.spawn },
      blocked: mapDef.blocked.map((b) => ({ ...b })),
      prev: { x: mapDef.spawn.x, y: mapDef.spawn.y },
      queuedAction: null,
      projectiles: [],
      lastDamageAt: 0,
    };
  }

  return {
    rows: 7,
    cols: 7,
    mapId: "default",
    mapSeed: 0,

    ship: {
      x: 3,
      y: 3,
      dir: DIR.N,
      hp: 3,
      ammo: 15,
    },

    blocked: [
      { x: 1, y: 1, kind: "rock" },
      { x: 2, y: 1, kind: "rock" },
      { x: 5, y: 2, kind: "reef" },
      { x: 3, y: 4, kind: "wall" },
      { x: 4, y: 4, kind: "wall" },
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
    blocked: s.blocked.map(p => ({ ...p })),
    queuedAction: s.queuedAction ? { ...s.queuedAction } : null,
    projectiles: s.projectiles.map(p => ({ ...p })),
  };
}
