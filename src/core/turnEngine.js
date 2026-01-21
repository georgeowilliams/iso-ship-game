import { resolveMove, resolveShoot, resolveNoop } from "./rules.js";

/**
 * TurnEngine owns:
 * - timing (tick every turnMs)
 * - resolving exactly 1 action per tick (or noop)
 *
 * Multiplayer-ready note:
 * - In a real multiplayer version, only the server would run this.
 * - Clients would just send votes/actions; server emits authoritative state snapshots.
 */
export class TurnEngine {
  constructor({ initialState, turnMs = 2000, now = () => performance.now() }) {
    this.state = initialState;
    this.turnMs = turnMs;
    this.now = now;
    this.nextTickAt = this.now() + this.turnMs;

    // Useful for UI: last move steps + outcome
    this.lastOutcome = null;
    this.lastMoveSteps = null;
  }

  queueAction(action) {
    this.state = { ...this.state, queuedAction: action };
  }

  update() {
    const t = this.now();
    if (t < this.nextTickAt) return;

    // catch-up without drift
    const overdue = t - this.nextTickAt;
    const steps = Math.floor(overdue / this.turnMs) + 1;
    this.nextTickAt += steps * this.turnMs;

    const action = this.state.queuedAction;

    if (!action) {
      const { nextState, outcome } = resolveNoop(this.state);
      this.state = nextState;
      this.lastOutcome = outcome;
      this.lastMoveSteps = null;
      return;
    }

    if (action.type === "move") {
      const { nextState, outcome } = resolveMove(this.state, action.move, t);
      this.state = { ...nextState, queuedAction: null };
      this.lastOutcome = outcome;
      this.lastMoveSteps = outcome.steps || null;
      return;
    }

    if (action.type === "shoot") {
      const { nextState, outcome } = resolveShoot(this.state, t);
      this.state = { ...nextState, queuedAction: null };
      this.lastOutcome = outcome;
      this.lastMoveSteps = null;
      return;
    }

    // Unknown action -> treat as noop tick
    const { nextState, outcome } = resolveNoop({ ...this.state, queuedAction: null });
    this.state = nextState;
    this.lastOutcome = outcome;
    this.lastMoveSteps = null;
  }

  msLeft() {
    return this.nextTickAt - this.now();
  }
}
