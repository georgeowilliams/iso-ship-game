import { DIR_V, leftOf, rightOf } from "./constants.js";

// --- helpers (pure) ---
export function inBounds(state, x, y) {
  return x >= 0 && x < state.cols && y >= 0 && y < state.rows;
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

  const blockedMap = makeBlockedMap(next.blocked);

  const { newDir, steps } = computeMoveSteps(next.ship.x, next.ship.y, next.ship.dir, move);

  // rotate on intent even if fail
  next.ship.dir = newDir;

  if (steps.length === 0) {
    return {
      nextState: next,
      outcome: { moved: false, damaged: false, damage: 0, reason: "noop", steps }
    };
  }

  // path check (prevents moving through blocked on L/R)
  for (const s of steps) {
    if (!inBounds(next, s.x, s.y)) {
      return {
        nextState: next,
        outcome: { moved: false, damaged: false, damage: 0, reason: "oob", steps }
      };
    }
    if (isBlocked(blockedMap, s.x, s.y)) {
      const kind = blockedMap.get(`${s.x},${s.y}`);
      const damage = blockedDamage(kind);
      if (damage > 0) {
        next.ship.hp = Math.max(0, next.ship.hp - damage);
        next.lastDamageAt = nowMs;
      }
      return {
        nextState: next,
        outcome: { moved: false, damaged: damage > 0, damage, reason: "blocked", steps }
      };
    }
  }

  // success lands on final step
  const last = steps[steps.length - 1];
  next.ship.x = last.x;
  next.ship.y = last.y;

  return {
    nextState: next,
    outcome: { moved: true, damaged: false, damage: 0, reason: "ok", steps }
  };
}

/**
 * Resolve SHOOT deterministically (projectiles are "visual"; state still holds them).
 * Fires port+starboard 2 tiles away (ammo - 1).
 */
export function resolveShoot(state, nowMs) {
  const next = structuredCloneLite(state);

  if (next.ship.ammo <= 0) {
    return { nextState: next, outcome: { shot: false, reason: "no_ammo" } };
  }

  const portDir = leftOf(next.ship.dir);
  const starDir = rightOf(next.ship.dir);

  const portV = DIR_V[portDir];
  const starV = DIR_V[starDir];

  const portStep1 = { x: next.ship.x + portV.x, y: next.ship.y + portV.y };
  const portStep2 = { x: next.ship.x + portV.x * 2, y: next.ship.y + portV.y * 2 };
  const starStep1 = { x: next.ship.x + starV.x, y: next.ship.y + starV.y };
  const starStep2 = { x: next.ship.x + starV.x * 2, y: next.ship.y + starV.y * 2 };

  const durationMs = 450;

  if (inBounds(next, portStep1.x, portStep1.y)) {
    const path = [portStep1];
    if (inBounds(next, portStep2.x, portStep2.y)) {
      path.push(portStep2);
    }
    const last = path[path.length - 1];
    next.projectiles.push({
      fromX: next.ship.x, fromY: next.ship.y,
      toX: last.x, toY: last.y,
      spawnTime: nowMs, durationMs,
      path
    });
  }
  if (inBounds(next, starStep1.x, starStep1.y)) {
    const path = [starStep1];
    if (inBounds(next, starStep2.x, starStep2.y)) {
      path.push(starStep2);
    }
    const last = path[path.length - 1];
    next.projectiles.push({
      fromX: next.ship.x, fromY: next.ship.y,
      toX: last.x, toY: last.y,
      spawnTime: nowMs, durationMs,
      path
    });
  }

  next.ship.ammo = Math.max(0, next.ship.ammo - 1);
  return { nextState: next, outcome: { shot: true, reason: "ok" } };
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
    prev: { ...s.prev },
    blocked: s.blocked.map(p => ({ ...p })),
    queuedAction: s.queuedAction ? { ...s.queuedAction } : null,
    projectiles: s.projectiles.map(p => ({ ...p })),
  };
}
