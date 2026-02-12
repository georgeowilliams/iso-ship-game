import { describe, it, expect } from "vitest";
import { createInitialState, expandBlockedGroups } from "../src/core/state.js";
import { resolveMove, resolveNoop, resolveShoot, computeMoveSteps, inBounds } from "../src/core/rules.js";
import { leftOf, rightOf } from "../src/core/constants.js";

describe("rules: movement", () => {
  it("F moves 1 forward when clear", () => {
    const s = createInitialState();
    const startX = s.ship.x;
    const startY = s.ship.y;
    const { nextState, outcome } = resolveMove(s, "F", 0);
    expect(outcome.moved).toBe(true);
    expect(nextState.ship.x).toBe(startX);
    expect(nextState.ship.y).toBe(startY - 1);
    expect(nextState.prev).toEqual({ x: startX, y: startY });
  });

  it("L checks step1 and step2; blocked on step1 fails + damages", () => {
    const s = createInitialState();
    const startX = s.ship.x;
    const startY = s.ship.y;
    s.blocked = [{ x: startX, y: startY - 1, kind: "rock" }];
    const { nextState, outcome } = resolveMove(s, "L", 123);
    expect(outcome.moved).toBe(false);
    expect(outcome.damaged).toBe(true);
    expect(nextState.ship.hp).toBe(5);
    expect(outcome.damage).toBe(1);
    expect(nextState.ship.dir).toBe(leftOf(s.ship.dir));
    expect(nextState.ship.x).toBe(startX);
    expect(nextState.ship.y).toBe(startY);
    expect(nextState.prev).toEqual({ x: startX, y: startY });
  });

  it("R checks step2; blocked on step2 fails + damages", () => {
    const s = createInitialState();
    const startX = s.ship.x;
    const startY = s.ship.y;
    s.blocked = [{ x: startX + 1, y: startY - 1, kind: "reef" }];
    const { nextState, outcome } = resolveMove(s, "R", 0);
    expect(outcome.moved).toBe(true);
    expect(outcome.damaged).toBe(true);
    expect(nextState.ship.hp).toBe(5);
    expect(outcome.damage).toBe(1);
    expect(nextState.ship.dir).toBe(rightOf(s.ship.dir));
    expect(nextState.ship.x).toBe(startX);
    expect(nextState.ship.y).toBe(startY - 1);
    expect(nextState.prev).toEqual({ x: startX, y: startY });
  });

  it("blocked wall prevents movement without damage", () => {
    const s = createInitialState();
    const startX = s.ship.x;
    const startY = s.ship.y;
    s.blocked = [{ x: startX, y: startY - 1, kind: "wall" }];
    const { nextState, outcome } = resolveMove(s, "F", 0);
    expect(outcome.moved).toBe(false);
    expect(outcome.damaged).toBe(false);
    expect(outcome.damage).toBe(0);
    expect(nextState.ship.hp).toBe(6);
    expect(nextState.ship.x).toBe(startX);
    expect(nextState.ship.y).toBe(startY);
    expect(nextState.prev).toEqual({ x: startX, y: startY });
  });

  it("computeMoveSteps returns 2 steps for L/R", () => {
    const s = createInitialState();
    const left = computeMoveSteps(s.ship.x, s.ship.y, s.ship.dir, "L");
    const right = computeMoveSteps(s.ship.x, s.ship.y, s.ship.dir, "R");
    expect(left.steps.length).toBe(2);
    expect(right.steps.length).toBe(2);
  });

  it("noop tick sets prev to current tile", () => {
    const s = createInitialState();
    s.ship.x = 2;
    s.ship.y = 5;
    const { nextState, outcome } = resolveNoop(s);
    expect(outcome.reason).toBe("noop_tick");
    expect(nextState.prev).toEqual({ x: 2, y: 5 });
  });
});

describe("rules: shooting paths", () => {
  it("facing N spawns port west and starboard east paths", () => {
    const s = createInitialState();
    s.ship.x = 3;
    s.ship.y = 3;
    s.ship.dir = 0;
    const { nextState } = resolveShoot(s, 0);
    expect(nextState.projectiles).toHaveLength(2);
    const [port, star] = nextState.projectiles;
    expect(port.path).toEqual([{ x: 2, y: 3 }, { x: 1, y: 3 }, { x: 0, y: 3 }]);
    expect(star.path).toEqual([{ x: 4, y: 3 }, { x: 5, y: 3 }, { x: 6, y: 3 }]);
  });

  it("OOB step2 truncates path but still spawns projectile", () => {
    const s = createInitialState();
    s.ship.x = s.world.maxX - 1;
    s.ship.y = 3;
    s.ship.dir = 0;
    const { nextState } = resolveShoot(s, 0);
    const star = nextState.projectiles.find((p) => p.path?.[0]?.x === s.world.maxX);
    expect(star.path).toEqual([{ x: s.world.maxX, y: 3 }]);
  });

  it("OOB step1 prevents projectile spawn", () => {
    const s = createInitialState();
    s.ship.x = 0;
    s.ship.y = 0;
    s.ship.dir = 0;
    const { nextState } = resolveShoot(s, 0);
    const port = nextState.projectiles.find((p) => p.path?.[0]?.x === -1);
    expect(port).toBeUndefined();
  });
});


describe("rules: world bounds", () => {
  it("inBounds uses world bounds rather than viewport size", () => {
    const s = createInitialState("grand-world");
    expect(inBounds(s, 24, 24)).toBe(true);
    expect(inBounds(s, 25, 24)).toBe(false);
    expect(inBounds(s, s.viewX0 + s.viewCols, s.viewY0)).toBe(true);
  });
});

describe("state: blocked group expansion", () => {
  it("expands bottom-anchored rectangular footprints into collision tiles", () => {
    const tiles = expandBlockedGroups([
      {
        id: "test-group",
        kind: "wall",
        anchor: { x: 10, y: 7, anchorMode: "bottom" },
        footprint: { w: 3, h: 2 },
      },
    ]);

    expect(tiles).toEqual([
      { x: 10, y: 6, kind: "wall", groupId: "test-group" },
      { x: 11, y: 6, kind: "wall", groupId: "test-group" },
      { x: 12, y: 6, kind: "wall", groupId: "test-group" },
      { x: 10, y: 7, kind: "wall", groupId: "test-group" },
      { x: 11, y: 7, kind: "wall", groupId: "test-group" },
      { x: 12, y: 7, kind: "wall", groupId: "test-group" },
    ]);
  });
});
