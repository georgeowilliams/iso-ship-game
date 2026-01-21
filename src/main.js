import { createInitialState } from "./core/state.js";
import { TurnEngine } from "./core/turnEngine.js";
import { CanvasRenderer } from "./render/renderer.js";
import { installKeyboard } from "./input/keyboard.js";

const canvas = document.getElementById("game");

const engine = new TurnEngine({
  initialState: createInitialState(),
  turnMs: 2000,
});

const renderer = new CanvasRenderer(canvas);

// Input adapter: keyboard -> queue action
installKeyboard({
  onAction: (action) => engine.queueAction(action),
});

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
