import { DIR } from "./constants.js";
import { getMapById } from "../maps/maps.js";

export function createInitialState(mapId) {
  const mapDef = getMapById(mapId);
  const hazardDamageByKey = {};
  (mapDef.hazards ?? []).forEach((hazard) => {
    hazardDamageByKey[`${hazard.x},${hazard.y}`] = hazard.damage;
  });

  return {
    rows: mapDef.grid.rows,
    cols: mapDef.grid.cols,
    mapId: mapDef.id,
    mapSeed: mapDef.seed,
    theme: mapDef.theme,
    ship: {
      x: mapDef.spawn.x,
      y: mapDef.spawn.y,
      dir: mapDef.spawn.dir ?? DIR.N,
      hp: mapDef.spawn.hp,
      ammo: mapDef.spawn.ammo,
    },
    blocked: mapDef.blocked.map((b) => ({ ...b })),
    hazards: mapDef.hazards ? mapDef.hazards.map((h) => ({ ...h })) : [],
    hazardDamageByKey,
    mode: "playing",

    // highlight of previous tile
    prev: { x: mapDef.spawn.x, y: mapDef.spawn.y },

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
