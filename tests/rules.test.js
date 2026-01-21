import { describe, it, expect } from "vitest";
import { createInitialState } from "../src/core/state.js";
import { resolveMove, makeBlockedSet, isBlocked, computeMoveSteps } from "../src/core/rules.js";

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
    s.blocked = [[3,2]];
    const { nextState, outcome } = resolveMove(s, "L", 123);
    expect(outcome.moved).toBe(false);
    expect(outcome.damaged).toBe(true);
    expect(nextState.ship.hp).toBe(2);
    // ship does not move
    expect(nextState.ship.x).toBe(3);
    expect(nextState.ship.y).toBe(3);
    // prev becomes current tile on fail (old == current)
    expect(nextState.prev).toEqual({ x: 3, y: 3 });
  });

  it("R checks step2; blocked on step2 fails + damages", () => {
    const s = createInitialState();
    // Facing N: step1=(3,2), step2=(4,2)
    s.blocked = [[4,2]];
    const { nextState, outcome } = resolveMove(s, "R", 0);
    expect(outcome.moved).toBe(false);
    expect(outcome.damaged).toBe(true);
    expect(nextState.ship.hp).toBe(2);
    expect(nextState.ship.x).toBe(3);
    expect(nextState.ship.y).toBe(3);
  });

  it("computeMoveSteps returns 2 steps for L/R", () => {
    const s = createInitialState();
    const left = computeMoveSteps(s.ship.x, s.ship.y, s.ship.dir, "L");
    const right = computeMoveSteps(s.ship.x, s.ship.y, s.ship.dir, "R");
    expect(left.steps.length).toBe(2);
    expect(right.steps.length).toBe(2);
  });
});
