import { describe, it, expect } from "vitest";
import { createInitialState } from "../src/core/state.js";
import { resolveMove, resolveNoop, resolveShoot, computeMoveSteps } from "../src/core/rules.js";
import { leftOf, rightOf } from "../src/core/constants.js";

describe("rules: movement", () => {
  it("F moves 1 forward when clear", () => {
    const s = createInitialState();
    // facing N at (3,3) -> forward is (3,2)
    const { nextState, outcome } = resolveMove(s, "F", 0);
    expect(outcome.moved).toBe(true);
    expect(nextState.ship.x).toBe(3);
    expect(nextState.ship.y).toBe(2);
    // prev becomes old tile
    expect(nextState.prev).toEqual({ x: 3, y: 3 });
  });

  it("L checks step1 and step2; blocked on step1 fails + damages", () => {
    const s = createInitialState();
    // Put a block directly in front of ship (3,2)
    s.blocked = [{ x: 3, y: 2, kind: "rock" }];
    const { nextState, outcome } = resolveMove(s, "L", 123);
    expect(outcome.moved).toBe(false);
    expect(outcome.damaged).toBe(true);
    expect(nextState.ship.hp).toBe(2);
    expect(outcome.damage).toBe(1);
    expect(nextState.ship.dir).toBe(leftOf(s.ship.dir));
    // ship does not move
    expect(nextState.ship.x).toBe(3);
    expect(nextState.ship.y).toBe(3);
    // prev becomes current tile on fail (old == current)
    expect(nextState.prev).toEqual({ x: 3, y: 3 });
  });

  it("R checks step2; blocked on step2 fails + damages", () => {
    const s = createInitialState();
    // Facing N: step1=(3,2), step2=(4,2)
    s.blocked = [{ x: 4, y: 2, kind: "reef" }];
    const { nextState, outcome } = resolveMove(s, "R", 0);
    expect(outcome.moved).toBe(false);
    expect(outcome.damaged).toBe(true);
    expect(nextState.ship.hp).toBe(2);
    expect(outcome.damage).toBe(1);
    expect(nextState.ship.dir).toBe(rightOf(s.ship.dir));
    expect(nextState.ship.x).toBe(3);
    expect(nextState.ship.y).toBe(3);
    expect(nextState.prev).toEqual({ x: 3, y: 3 });
  });

  it("blocked wall prevents movement without damage", () => {
    const s = createInitialState();
    s.blocked = [{ x: 3, y: 2, kind: "wall" }];
    const { nextState, outcome } = resolveMove(s, "F", 0);
    expect(outcome.moved).toBe(false);
    expect(outcome.damaged).toBe(false);
    expect(outcome.damage).toBe(0);
    expect(nextState.ship.hp).toBe(3);
    expect(nextState.ship.x).toBe(3);
    expect(nextState.ship.y).toBe(3);
    expect(nextState.prev).toEqual({ x: 3, y: 3 });
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
    expect(port.path).toEqual([{ x: 2, y: 3 }, { x: 1, y: 3 }]);
    expect(star.path).toEqual([{ x: 4, y: 3 }, { x: 5, y: 3 }]);
  });

  it("OOB step2 truncates path but still spawns projectile", () => {
    const s = createInitialState();
    s.ship.x = 5;
    s.ship.y = 3;
    s.ship.dir = 0;
    const { nextState } = resolveShoot(s, 0);
    const star = nextState.projectiles.find((p) => p.path?.[0]?.x === 6);
    expect(star.path).toEqual([{ x: 6, y: 3 }]);
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
