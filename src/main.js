import { createInitialState } from "./core/state.js";
import { TurnEngine } from "./core/turnEngine.js";
import { VoteCollector } from "./core/voteCollector.js";
import { CanvasRenderer } from "./render/renderer.js";
import { createKeyboardAdapter } from "./input/keyboard.js";

const canvas = document.getElementById("game");

const voteCollector = new VoteCollector();

const engine = new TurnEngine({
  initialState: createInitialState(),
  turnMs: 2000,
  voteCollector,
});

const renderer = new CanvasRenderer(canvas);

// Input adapter: keyboard -> votes
const keyboard = createKeyboardAdapter({ userId: "local" });
keyboard.start((vote) => voteCollector.addVote(vote));

function frame() {
  engine.update();

  renderer.render({
    state: engine.state,
    msLeft: engine.msLeft(),
    lastMoveSteps: engine.lastMoveSteps,
  });

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
