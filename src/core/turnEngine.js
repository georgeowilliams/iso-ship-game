import {
  pruneProjectiles,
  resolveMove,
  resolveShoot,
  resolveNoop,
  resolveEnemyMove,
  resolveEnemyShoot,
  computeShotPaths
} from "./rules.js";
import { createInitialState } from "./state.js";

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
  constructor({ initialState, turnMs = 2000, now = () => performance.now(), voteCollector = null }) {
    this.state = initialState;
    this.turnMs = turnMs;
    this.now = now;
    this.voteCollector = voteCollector;
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
    if (this.state.mode && this.state.mode !== "playing") return;
    if (this.state.projectiles.length > 0) {
      const nextState = pruneProjectiles(this.state, t);
      if (nextState.projectiles.length !== this.state.projectiles.length) {
        this.state = nextState;
      }
    }
    if (t < this.nextTickAt) return;

    // catch-up without drift
    const overdue = t - this.nextTickAt;
    const steps = Math.floor(overdue / this.turnMs) + 1;
    this.nextTickAt += steps * this.turnMs;

    let action = this.state.queuedAction;
    if (!action && this.voteCollector) {
      const choice = this.voteCollector.resolveWinner();
      action = choice ? this.voteToAction(choice) : null;
    }

    if (!action) {
      const { nextState, outcome } = resolveNoop(this.state);
      this.state = nextState;
      this.lastOutcome = outcome;
      this.lastMoveSteps = null;
    }

    if (action?.type === "move") {
      const { nextState, outcome } = resolveMove(this.state, action.move, t);
      this.state = { ...nextState, queuedAction: null };
      if (outcome.moved) {
        this.applyHazardDamage();
      }
      this.lastOutcome = outcome;
      this.lastMoveSteps = outcome.steps || null;
    } else if (action?.type === "shoot") {
      const { nextState, outcome } = resolveShoot(this.state, t);
      this.state = { ...nextState, queuedAction: null };
      if (outcome.shot) {
        this.applyShotDamage("ship", "enemy", t);
      }
      this.lastOutcome = outcome;
      this.lastMoveSteps = null;
    } else if (action) {
      // Unknown action -> treat as noop tick
      const { nextState, outcome } = resolveNoop({ ...this.state, queuedAction: null });
      this.state = nextState;
      this.lastOutcome = outcome;
      this.lastMoveSteps = null;
    }

    if (this.state.enemy.hp <= 0) {
      this.respawnEnemy();
    } else {
      this.resolveEnemyTurn(t);
    }

    if (this.voteCollector) this.voteCollector.reset();
  }

  msLeft() {
    return this.nextTickAt - this.now();
  }

  voteToAction(choice) {
    if (choice === "SHOOT") {
      return { type: "shoot", label: "VOTE: SHOOT" };
    }
    return { type: "move", move: choice, label: `VOTE: ${choice}` };
  }

  loadMap(mapDef) {
    this.state = createInitialState(mapDef?.id ?? mapDef);
    this.nextTickAt = this.now() + this.turnMs;
    this.lastOutcome = null;
    this.lastMoveSteps = null;
  }

  applyHazardDamage() {
    const key = `${this.state.ship.x},${this.state.ship.y}`;
    const damage = this.state.hazardDamageByKey?.[key] ?? 0;
    if (damage > 0) {
      this.state.ship.hp = Math.max(0, this.state.ship.hp - damage);
      if (this.state.ship.hp === 0) {
        this.state.mode = "gameOver";
      }
    }
  }

  applyEnemyHazardDamage() {
    const key = `${this.state.enemy.x},${this.state.enemy.y}`;
    const damage = this.state.hazardDamageByKey?.[key] ?? 0;
    if (damage > 0) {
      this.state.enemy.hp = Math.max(0, this.state.enemy.hp - damage);
      this.state.enemy.lastDamageAt = this.now();
    }
  }

  resolveEnemyTurn(nowMs) {
    const action = this.rollEnemyAction();
    if (!action) return;

    if (action.type === "move") {
      const { nextState, outcome } = resolveEnemyMove(this.state, action.move, nowMs);
      this.state = nextState;
      if (outcome.moved) {
        this.applyEnemyHazardDamage();
      }
      return;
    }

    if (action.type === "shoot") {
      const { nextState, outcome } = resolveEnemyShoot(this.state, nowMs);
      this.state = nextState;
      if (outcome.shot) {
        this.applyShotDamage("enemy", "ship", nowMs);
      }
    }
  }

  rollEnemyAction() {
    const choices = ["F", "L", "R", "SHOOT"];
    const pick = choices[Math.floor(Math.random() * choices.length)];
    if (pick === "SHOOT") {
      return { type: "shoot" };
    }
    return { type: "move", move: pick };
  }

  applyShotDamage(attackerKey, targetKey, nowMs) {
    const attacker = this.state[attackerKey];
    const target = this.state[targetKey];
    const paths = computeShotPaths(this.state, attacker);
    let totalDamage = 0;

    paths.forEach((path) => {
      if (path.some((tile) => tile.x === target.x && tile.y === target.y)) {
        totalDamage += 1;
      }
    });

    if (totalDamage <= 0) return;
    target.hp = Math.max(0, target.hp - totalDamage);
    if (targetKey === "ship") {
      this.state.lastDamageAt = nowMs;
      if (target.hp === 0) {
        this.state.mode = "gameOver";
      }
    } else {
      target.lastDamageAt = nowMs;
    }
  }

  respawnEnemy() {
    this.state.enemy = {
      ...this.state.enemy,
      x: this.state.enemySpawn.x,
      y: this.state.enemySpawn.y,
      dir: this.state.enemySpawn.dir ?? this.state.enemy.dir,
      hp: this.state.enemy.maxHp,
      ammo: this.state.enemySpawn.ammo ?? this.state.enemy.ammo,
      lastDamageAt: 0,
    };
  }
}
