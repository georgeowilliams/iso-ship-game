import { DIR } from "./constants.js";
import { getMapById } from "../maps/maps.js";

export function createInitialState(mapId) {
  const mapDef = getMapById(mapId);
  const blockedKeys = new Set(mapDef.blocked.map((b) => `${b.x},${b.y}`));
  const enemySpawn = mapDef.enemySpawn ?? findFallbackEnemySpawn(mapDef, blockedKeys);
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
      maxHp: mapDef.spawn.hp,
      ammo: mapDef.spawn.ammo,
      prevX: mapDef.spawn.x,
      prevY: mapDef.spawn.y,
      movedAtMs: 0,
    },
    enemy: {
      x: enemySpawn.x,
      y: enemySpawn.y,
      dir: enemySpawn.dir ?? DIR.S,
      hp: enemySpawn.hp ?? mapDef.spawn.hp,
      maxHp: enemySpawn.hp ?? mapDef.spawn.hp,
      ammo: enemySpawn.ammo ?? mapDef.spawn.ammo,
      lastDamageAt: 0,
      prevX: enemySpawn.x,
      prevY: enemySpawn.y,
      movedAtMs: 0,
    },
    enemySpawn: { ...enemySpawn },
    blocked: mapDef.blocked.map((b) => ({ ...b })),
    hazards: mapDef.hazards ? mapDef.hazards.map((h) => ({ ...h })) : [],
    hazardDamageByKey,
    result: null,
    resultAtMs: null,
    mode: "playing",

    // highlight of previous tile
    prev: { x: mapDef.spawn.x, y: mapDef.spawn.y },
    playerPrev: null,
    enemyPrev: null,
    playerPrevJumpTile: null,
    enemyPrevJumpTile: null,

    // queued action from any input adapter
    // { type: "move", move: "F"|"L"|"R" }
    // { type: "shoot" }
    queuedAction: null,

    // rendering-only ephemeral
    projectiles: [], // {fromX,fromY,toX,toY,spawnTime,durationMs}
    lastShotTiles: [],
    lastDamageAt: 0,
  };
}

export function cloneState(s) {
  // minimal structured clone to keep core deterministic and safe
  return {
    ...s,
    ship: { ...s.ship },
    enemy: { ...s.enemy },
    enemySpawn: { ...s.enemySpawn },
    prev: { ...s.prev },
    playerPrev: s.playerPrev ? { ...s.playerPrev } : null,
    enemyPrev: s.enemyPrev ? { ...s.enemyPrev } : null,
    playerPrevJumpTile: s.playerPrevJumpTile ? { ...s.playerPrevJumpTile } : null,
    enemyPrevJumpTile: s.enemyPrevJumpTile ? { ...s.enemyPrevJumpTile } : null,
    blocked: s.blocked.map(p => ({ ...p })),
    queuedAction: s.queuedAction ? { ...s.queuedAction } : null,
    projectiles: s.projectiles.map(p => ({ ...p })),
    lastShotTiles: s.lastShotTiles ? s.lastShotTiles.map(t => ({ ...t })) : [],
    result: s.result,
    resultAtMs: s.resultAtMs,
  };
}

function findFallbackEnemySpawn(mapDef, blockedKeys) {
  for (let y = 0; y < mapDef.grid.rows; y += 1) {
    for (let x = 0; x < mapDef.grid.cols; x += 1) {
      const key = `${x},${y}`;
      if (blockedKeys.has(key)) continue;
      if (x === mapDef.spawn.x && y === mapDef.spawn.y) continue;
      return { x, y, dir: DIR.S, hp: mapDef.spawn.hp, ammo: mapDef.spawn.ammo };
    }
  }
  return { x: mapDef.spawn.x, y: mapDef.spawn.y, dir: DIR.S, hp: mapDef.spawn.hp, ammo: mapDef.spawn.ammo };
}
