import { describe, it, expect } from "vitest";
import { createInitialState } from "../src/core/state.js";
import { TurnEngine } from "../src/core/turnEngine.js";
import { VoteCollector } from "../src/core/voteCollector.js";

describe("TurnEngine voting integration", () => {
  it("uses votes when no direct action is queued", () => {
    const voteCollector = new VoteCollector();
    let t = 0;
    const engine = new TurnEngine({
      initialState: createInitialState(),
      turnMs: 2000,
      now: () => t,
      voteCollector,
    });

    voteCollector.addVote({ userId: "local", choice: "F" });
    t = 2001;
    engine.update();

    expect(engine.state.ship.x).toBe(3);
    expect(engine.state.ship.y).toBe(2);
    expect(engine.lastOutcome?.moved).toBe(true);
    expect(voteCollector.resolveWinner()).toBe(null);
  });

  it("direct queued actions take precedence over votes", () => {
    const voteCollector = new VoteCollector();
    let t = 0;
    const engine = new TurnEngine({
      initialState: createInitialState(),
      turnMs: 2000,
      now: () => t,
      voteCollector,
    });

    voteCollector.addVote({ userId: "local", choice: "F" });
    engine.queueAction({ type: "move", move: "R", label: "MOVE: FORWARD+RIGHT" });
    t = 2001;
    engine.update();

    expect(engine.state.ship.x).toBe(4);
    expect(engine.state.ship.y).toBe(2);
    expect(engine.lastOutcome?.moved).toBe(true);
    expect(voteCollector.resolveWinner()).toBe(null);
  });

  it("applies hazard damage after successful movement only", () => {
    const voteCollector = new VoteCollector();
    let t = 0;
    const engine = new TurnEngine({
      initialState: createInitialState("islands"),
      turnMs: 2000,
      now: () => t,
      voteCollector,
    });

    engine.state.ship.x = 0;
    engine.state.ship.y = 3;
    engine.state.ship.dir = 1;
    engine.state.lastCheckpointId = null;
    engine.state.lastCheckpoint = null;

    engine.queueAction({ type: "move", move: "F", label: "MOVE: FORWARD" });
    t = 2001;
    engine.update();
    expect(engine.state.ship.hp).toBe(5);

    engine.queueAction({ type: "move", move: "F", label: "MOVE: FORWARD" });
    t = 4002;
    engine.update();
    expect(engine.state.ship.hp).toBe(5);
  });

  it("enters game over when hazard reduces HP to zero", () => {
    const voteCollector = new VoteCollector();
    let t = 0;
    const engine = new TurnEngine({
      initialState: createInitialState("islands"),
      turnMs: 2000,
      now: () => t,
      voteCollector,
    });

    engine.state.ship.hp = 1;
    engine.state.ship.x = 4;
    engine.state.ship.y = 3;
    engine.state.ship.dir = 1;
    engine.state.lastCheckpointId = null;
    engine.state.lastCheckpoint = null;

    engine.queueAction({ type: "move", move: "F", label: "MOVE: FORWARD" });
    t = 2001;
    engine.update();
    expect(engine.state.result).toBe("loss");
  });
});


describe("TurnEngine checkpoints", () => {
  it("sets deterministic checkpoint snapshot when entering checkpoint radius", () => {
    let t = 0;
    const engine = new TurnEngine({
      initialState: createInitialState("grand-world"),
      turnMs: 2000,
      now: () => t,
      voteCollector: new VoteCollector(),
    });

    engine.state.ship.x = 11;
    engine.state.ship.y = 12;
    engine.state.ship.dir = 1;
    engine.state.lastCheckpointId = null;
    engine.state.lastCheckpoint = null;

    engine.queueAction({ type: "move", move: "F", label: "MOVE: FORWARD" });

    t = 2001;
    engine.update();

    expect(engine.state.lastCheckpointId).toBe("cp-center");
    expect(engine.state.lastCheckpoint?.turnIndex).toBe(1);
    expect(engine.state.lastCheckpoint?.ship).toEqual({
      x: engine.state.ship.x,
      y: engine.state.ship.y,
      dir: engine.state.ship.dir,
      hp: engine.state.ship.hp,
      ammo: engine.state.ship.ammo,
    });
  });
});
