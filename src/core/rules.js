import { DIR_V, leftOf, rightOf } from "./constants.js";

// --- helpers (pure) ---
export function inBounds(state, x, y) {
  return x >= state.world.minX
    && x <= state.world.maxX
    && y >= state.world.minY
    && y <= state.world.maxY;
}

export function makeBlockedMap(blocked) {
  return new Map(blocked.map(({ x, y, kind }) => [`${x},${y}`, kind ?? "rock"]));
}

export function isBlocked(blockedMap, x, y) {
  return blockedMap.has(`${x},${y}`);
}

export function blockedDamage(kind) {
  if (kind === "wall") return 0;
  return 1;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const BOUNCE_HOLD_MS = 90;

/**
 * Move definitions (relative to facing):
 * - F: one tile forward
 * - L: one tile forward, then one tile left (2-step)
 * - R: one tile forward, then one tile right (2-step)
 *
 * Rotation on intent:
 * - F => keep facing
 * - L => face left
 * - R => face right
 */
export function computeMoveSteps(shipX, shipY, shipDir, move) {
  const f = DIR_V[shipDir];
  const l = DIR_V[leftOf(shipDir)];
  const r = DIR_V[rightOf(shipDir)];

  if (move === "F") {
    return { newDir: shipDir, steps: [{ x: shipX + f.x, y: shipY + f.y }] };
  }
  if (move === "L") {
    const s1 = { x: shipX + f.x, y: shipY + f.y };
    const s2 = { x: s1.x + l.x, y: s1.y + l.y };
    return { newDir: leftOf(shipDir), steps: [s1, s2] };
  }
  if (move === "R") {
    const s1 = { x: shipX + f.x, y: shipY + f.y };
    const s2 = { x: s1.x + r.x, y: s1.y + r.y };
    return { newDir: rightOf(shipDir), steps: [s1, s2] };
  }

  return { newDir: shipDir, steps: [] };
}

/**
 * Resolve a MOVE action deterministically.
 * Returns { nextState, outcome } where outcome includes:
 * - moved: boolean
 * - damaged: boolean
 * - damage: number (0 or 1)
 * - reason: "ok" | "oob" | "blocked" | "noop"
 * - steps: computed steps (for UI highlight)
 */
export function resolveMove(state, move, nowMs) {
  const next = structuredCloneLite(state);

  // requirement: on any move attempt (success/fail), prev becomes current tile
  next.prev = { x: next.ship.x, y: next.ship.y };

  const resolution = resolveMoveForShip({
    state: next,
    shipKey: "ship",
    otherKey: "enemy",
    move,
    nowMs,
  });

  return resolution;
}

/**
 * Resolve a MOVE action for the enemy ship deterministically.
 */
export function resolveEnemyMove(state, move, nowMs) {
  const next = structuredCloneLite(state);
  return resolveMoveForShip({
    state: next,
    shipKey: "enemy",
    otherKey: "ship",
    move,
    nowMs,
  });
}

function resolveMoveForShip({ state, shipKey, otherKey, move, nowMs }) {
  const next = state;
  const ship = next[shipKey];
  const other = next[otherKey];
  const blockedMap = makeBlockedMap(next.blocked);
  const start = { x: ship.x, y: ship.y };
  const dirBefore = ship.dir;
  const { newDir, steps } = computeMoveSteps(ship.x, ship.y, ship.dir, move);

  // rotate on intent even if fail
  ship.dir = newDir;

  if (steps.length === 0) {
    return {
      nextState: next,
      outcome: { moved: false, damaged: false, damage: 0, reason: "noop", steps }
    };
  }

  const damageShip = (damage) => {
    if (damage <= 0) return;
    ship.hp = Math.max(0, ship.hp - damage);
    if (shipKey === "ship") {
      next.lastDamageAt = nowMs;
    } else {
      ship.lastDamageAt = nowMs;
    }
  };

  const bounceToStart = (target, damage, reason) => {
    damageShip(damage);
    const shouldHold = reason === "oob" || reason === "blocked";
    return {
      nextState: next,
      outcome: {
        moved: false,
        damaged: damage > 0,
        damage,
        reason,
        steps,
        animPathTiles: [start, target, start],
        animDirs: [dirBefore, ship.dir],
        animHoldIndex: shouldHold ? 1 : null,
        animHoldMs: shouldHold ? BOUNCE_HOLD_MS : 0,
      }
    };
  };

  const corner = steps[0];

  if (!inBounds(next, corner.x, corner.y)) {
    if (steps.length === 1) {
      return bounceToStart(corner, 0, "oob");
    }

    const final = steps[1];
    const landing = {
      x: clamp(final.x, next.world.minX, next.world.maxX),
      y: clamp(final.y, next.world.minY, next.world.maxY),
    };
    ship.x = landing.x;
    ship.y = landing.y;
    return {
      nextState: next,
      outcome: {
        moved: true,
        damaged: false,
        damage: 0,
        reason: "corner_oob_slide",
        steps,
        animPathTiles: [start, corner, final, landing],
        animDirs: [dirBefore, ship.dir, ship.dir],
        animHoldIndex: 2,
        animHoldMs: BOUNCE_HOLD_MS,
      }
    };
  }

  if (corner.x === other.x && corner.y === other.y) {
    return bounceToStart(corner, 1, "collision");
  }

  if (isBlocked(blockedMap, corner.x, corner.y)) {
    const kind = blockedMap.get(`${corner.x},${corner.y}`);
    const damage = blockedDamage(kind);
    return bounceToStart(corner, damage, "blocked");
  }

  if (steps.length === 1) {
    ship.x = corner.x;
    ship.y = corner.y;
    return {
      nextState: next,
      outcome: {
        moved: true,
        damaged: false,
        damage: 0,
        reason: "ok",
        steps,
        animPathTiles: [start, corner],
        animDirs: [ship.dir],
      }
    };
  }

  const final = steps[1];

  if (!inBounds(next, final.x, final.y)) {
    ship.x = corner.x;
    ship.y = corner.y;
    return {
      nextState: next,
      outcome: {
        moved: true,
        damaged: false,
        damage: 0,
        reason: "corner_oob",
        steps,
        animPathTiles: [start, corner, final, corner],
        animDirs: [dirBefore, ship.dir, ship.dir],
        animHoldIndex: 2,
        animHoldMs: BOUNCE_HOLD_MS,
      }
    };
  }

  if (final.x === other.x && final.y === other.y) {
    damageShip(1);
    ship.x = corner.x;
    ship.y = corner.y;
    return {
      nextState: next,
      outcome: {
        moved: true,
        damaged: true,
        damage: 1,
        reason: "collision",
        steps,
        animPathTiles: [start, corner, final, corner],
        animDirs: [dirBefore, ship.dir, ship.dir],
      }
    };
  }

  if (isBlocked(blockedMap, final.x, final.y)) {
    damageShip(1);
    ship.x = corner.x;
    ship.y = corner.y;
    return {
      nextState: next,
      outcome: {
        moved: true,
        damaged: true,
        damage: 1,
        reason: "blocked",
        steps,
        animPathTiles: [start, corner, final, corner],
        animDirs: [dirBefore, ship.dir, ship.dir],
        animHoldIndex: 2,
        animHoldMs: BOUNCE_HOLD_MS,
      }
    };
  }

  ship.x = final.x;
  ship.y = final.y;

  return {
    nextState: next,
    outcome: {
      moved: true,
      damaged: false,
      damage: 0,
      reason: "ok",
      steps,
      animPathTiles: [start, corner, final],
      animDirs: [dirBefore, ship.dir],
    }
  };
}

/**
 * Resolve SHOOT deterministically (projectiles are "visual"; state still holds them).
 * Fires broadside up to 3 tiles (ammo - 1).
 */
export function resolveShoot(state, nowMs) {
  const next = structuredCloneLite(state);

  if (next.ship.ammo <= 0) {
    return { nextState: next, outcome: { shot: false, reason: "no_ammo" } };
  }

  const shotPaths = computeShotPaths(next, next.ship);
  const durationMs = 450;

  shotPaths.forEach((path) => {
    const last = path[path.length - 1];
    next.projectiles.push({
      fromX: next.ship.x, fromY: next.ship.y,
      toX: last.x, toY: last.y,
      spawnTime: nowMs, durationMs,
      path
    });
  });

  next.lastShotTilesPlayer = buildShotTiles(shotPaths);
  next.ship.ammo = Math.max(0, next.ship.ammo - 1);
  return { nextState: next, outcome: { shot: true, reason: "ok" } };
}

/**
 * Resolve SHOOT for the enemy ship (projectiles are "visual"; state still holds them).
 */
export function resolveEnemyShoot(state, nowMs) {
  const next = structuredCloneLite(state);

  if (next.enemy.ammo <= 0) {
    return { nextState: next, outcome: { shot: false, reason: "no_ammo" } };
  }

  const shotPaths = computeShotPaths(next, next.enemy);
  const durationMs = 450;

  shotPaths.forEach((path) => {
    const last = path[path.length - 1];
    next.projectiles.push({
      fromX: next.enemy.x, fromY: next.enemy.y,
      toX: last.x, toY: last.y,
      spawnTime: nowMs, durationMs,
      path
    });
  });

  next.lastShotTilesEnemy = buildShotTiles(shotPaths);
  next.enemy.ammo = Math.max(0, next.enemy.ammo - 1);
  return { nextState: next, outcome: { shot: true, reason: "ok" } };
}

export function computeShotPaths(state, ship) {
  const left = DIR_V[leftOf(ship.dir)];
  const right = DIR_V[rightOf(ship.dir)];
  const blockedMap = makeBlockedMap(state.blocked);
  const paths = [];

  const buildPath = (dir) => {
    const path = [];
    for (let step = 1; step <= 3; step += 1) {
      const x = ship.x + dir.x * step;
      const y = ship.y + dir.y * step;
      if (!inBounds(state, x, y)) break;
      path.push({ x, y });

      if (isBlocked(blockedMap, x, y)) {
        const kind = blockedMap.get(`${x},${y}`);
        if (kind !== "reef" && kind !== "rock") break;
      }
    }
    return path;
  };

  const leftPath = buildPath(left);
  if (leftPath.length > 0) paths.push(leftPath);
  const rightPath = buildPath(right);
  if (rightPath.length > 0) paths.push(rightPath);

  return paths;
}

function buildShotTiles(paths) {
  const damageByIndex = [3, 2, 1];
  const tiles = [];
  paths.forEach((path) => {
    path.forEach((tile, idx) => {
      const level = damageByIndex[idx] ?? 1;
      tiles.push({ x: tile.x, y: tile.y, level });
    });
  });
  return tiles;
}

/**
 * Called on a tick with NO action:
 * requirement: prev becomes current ship tile.
 */
export function resolveNoop(state) {
  const next = structuredCloneLite(state);
  next.prev = { x: next.ship.x, y: next.ship.y };
  return { nextState: next, outcome: { reason: "noop_tick" } };
}

/**
 * Remove expired projectiles from state (visual-only cleanup).
 */
export function pruneProjectiles(state, nowMs) {
  const next = structuredCloneLite(state);
  next.projectiles = next.projectiles.filter(
    (p) => nowMs - p.spawnTime < p.durationMs
  );
  return next;
}

// --- tiny local clone utility (fast and safe for this state shape) ---
function structuredCloneLite(s) {
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
    blockedGroups: s.blockedGroups ? s.blockedGroups.map(group => ({
      ...group,
      anchor: group.anchor ? { ...group.anchor } : null,
      footprint: group.footprint ? { ...group.footprint } : null,
      offsetPx: group.offsetPx ? { ...group.offsetPx } : null,
    })) : [],
    world: { ...s.world },
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
  };
}
