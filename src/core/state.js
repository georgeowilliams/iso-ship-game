import { DIR } from "./constants.js";
import { getMapById } from "../maps/maps.js";

export function createInitialState(mapId) {
  const mapDef = getMapById(mapId);
  const world = mapDef.world ?? {
    minX: 0,
    minY: 0,
    maxX: (mapDef.grid?.cols ?? 1) - 1,
    maxY: (mapDef.grid?.rows ?? 1) - 1,
  };
  const viewport = mapDef.viewport ?? mapDef.grid ?? { rows: 7, cols: 7 };
  const blockedGroups = (mapDef.blockedGroups ?? []).map((group) => ({
    ...group,
    anchor: {
      ...group.anchor,
      anchorMode: group.anchor?.anchorMode ?? "bottom",
    },
    offsetPx: { x: group.offsetPx?.x ?? 0, y: group.offsetPx?.y ?? 0 },
  }));
  const blocked = [
    ...(mapDef.blocked ?? []).map((b) => ({ ...b })),
    ...expandBlockedGroups(blockedGroups),
  ];
  const blockedKeys = new Set(blocked.map((b) => `${b.x},${b.y}`));
  const enemySpawn = mapDef.enemySpawn ?? findFallbackEnemySpawn(mapDef, blockedKeys);
  const hazardDamageByKey = {};
  (mapDef.hazards ?? []).forEach((hazard) => {
    hazardDamageByKey[`${hazard.x},${hazard.y}`] = hazard.damage;
  });

  const { viewX0, viewY0 } = computeCameraWindow({
    world,
    viewCols: viewport.cols,
    viewRows: viewport.rows,
    focusX: mapDef.spawn.x,
    focusY: mapDef.spawn.y,
  });

  return {
    viewRows: viewport.rows,
    viewCols: viewport.cols,
    viewX0,
    viewY0,
    world,
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
      animPathTiles: null,
      animDirs: null,
      animTotalMs: 0,
      animHoldIndex: null,
      animHoldMs: 0,
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
      animPathTiles: null,
      animDirs: null,
      animTotalMs: 0,
      animHoldIndex: null,
      animHoldMs: 0,
    },
    enemySpawn: { ...enemySpawn },
    blockedGroups,
    blocked,
    hazards: mapDef.hazards ? mapDef.hazards.map((h) => ({ ...h })) : [],
    hazardDamageByKey,
    checkpoints: mapDef.checkpoints ? mapDef.checkpoints.map((c) => ({ ...c })) : [],
    lastCheckpointId: null,
    lastCheckpoint: null,
    turnIndex: 0,
    result: null,
    resultAtMs: null,
    mode: "playing",

    // highlight of previous tile
    prev: { x: mapDef.spawn.x, y: mapDef.spawn.y },
    playerPrev: null,
    enemyPrev: null,
    playerPrevJumpTile: null,
    enemyPrevJumpTile: null,
    lastEdgeSlideLandingPlayer: null,
    lastEdgeSlideLandingEnemy: null,

    // queued action from any input adapter
    // { type: "move", move: "F"|"L"|"R" }
    // { type: "shoot" }
    queuedAction: null,

    // rendering-only ephemeral
    projectiles: [], // {fromX,fromY,toX,toY,spawnTime,durationMs}
    lastShotTilesPlayer: [],
    lastShotTilesEnemy: [],
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
    lastEdgeSlideLandingPlayer: s.lastEdgeSlideLandingPlayer ? { ...s.lastEdgeSlideLandingPlayer } : null,
    lastEdgeSlideLandingEnemy: s.lastEdgeSlideLandingEnemy ? { ...s.lastEdgeSlideLandingEnemy } : null,
    world: { ...s.world },
    blockedGroups: s.blockedGroups ? s.blockedGroups.map(group => ({
      ...group,
      anchor: group.anchor ? { ...group.anchor } : null,
      footprint: group.footprint ? { ...group.footprint } : null,
      offsetPx: group.offsetPx ? { ...group.offsetPx } : null,
    })) : [],
    blocked: s.blocked.map(p => ({ ...p })),
    checkpoints: s.checkpoints ? s.checkpoints.map(c => ({ ...c })) : [],
    lastCheckpoint: s.lastCheckpoint ? {
      ...s.lastCheckpoint,
      ship: { ...s.lastCheckpoint.ship },
      enemy: s.lastCheckpoint.enemy ? { ...s.lastCheckpoint.enemy } : undefined,
    } : null,
    queuedAction: s.queuedAction ? { ...s.queuedAction } : null,
    projectiles: s.projectiles.map(p => ({ ...p })),
    lastShotTilesPlayer: s.lastShotTilesPlayer ? s.lastShotTilesPlayer.map(t => ({ ...t })) : [],
    lastShotTilesEnemy: s.lastShotTilesEnemy ? s.lastShotTilesEnemy.map(t => ({ ...t })) : [],
    result: s.result,
    resultAtMs: s.resultAtMs,
  };
}

function findFallbackEnemySpawn(mapDef, blockedKeys) {
  const world = mapDef.world ?? {
    minX: 0,
    minY: 0,
    maxX: (mapDef.grid?.cols ?? 1) - 1,
    maxY: (mapDef.grid?.rows ?? 1) - 1,
  };
  for (let y = world.minY; y <= world.maxY; y += 1) {
    for (let x = world.minX; x <= world.maxX; x += 1) {
      const key = `${x},${y}`;
      if (blockedKeys.has(key)) continue;
      if (x === mapDef.spawn.x && y === mapDef.spawn.y) continue;
      return { x, y, dir: DIR.S, hp: mapDef.spawn.hp, ammo: mapDef.spawn.ammo };
    }
  }
  return { x: mapDef.spawn.x, y: mapDef.spawn.y, dir: DIR.S, hp: mapDef.spawn.hp, ammo: mapDef.spawn.ammo };
}

export function expandBlockedGroups(blockedGroups = []) {
  const expanded = [];
  blockedGroups.forEach((group) => {
    const mode = group.anchor?.anchorMode ?? "bottom";
    if (mode !== "bottom") return;
    const w = group.footprint?.w ?? 1;
    const h = group.footprint?.h ?? 1;
    const startY = group.anchor.y - (h - 1);
    for (let y = startY; y <= group.anchor.y; y += 1) {
      for (let x = group.anchor.x; x < group.anchor.x + w; x += 1) {
        expanded.push({ x, y, kind: group.kind, groupId: group.id });
      }
    }
  });
  return expanded;
}

export function computeCameraWindow({ world, viewCols, viewRows, focusX, focusY }) {
  const halfCols = Math.floor(viewCols / 2);
  const halfRows = Math.floor(viewRows / 2);
  const unclampedX0 = focusX - halfCols;
  const unclampedY0 = focusY - halfRows;
  const maxX0 = world.maxX - viewCols + 1;
  const maxY0 = world.maxY - viewRows + 1;
  return {
    viewX0: clamp(unclampedX0, world.minX, Math.max(world.minX, maxX0)),
    viewY0: clamp(unclampedY0, world.minY, Math.max(world.minY, maxY0)),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
