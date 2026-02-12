import { createInitialState } from "./core/state.js";
import { TurnEngine } from "./core/turnEngine.js";
import { VoteCollector } from "./core/voteCollector.js";
import { CanvasRenderer } from "./render/renderer.js";
import { AssetManager } from "./render/assetManager.js";
import { createKeyboardAdapter } from "./input/keyboard.js";
import { DEFAULT_MAP_ID, getDefaultMap } from "./maps/maps.js";

const canvas = document.getElementById("game");
const startButton = document.getElementById("start-game");
const quitButton = document.getElementById("quit");
const hudOverlay = document.getElementById("hud-overlay");
const hudTurn = document.getElementById("hud-turn");
const hudPhase = document.getElementById("hud-phase");
const hudCountdown = document.getElementById("hud-countdown");
const hudPosition = document.getElementById("hud-position");
const hudAmmo = document.getElementById("hud-ammo");
const hudQueued = document.getElementById("hud-queued");
const hudParticipants = document.getElementById("hud-participants");
const hudVoteForward = document.getElementById("hud-vote-forward");
const hudVoteLeft = document.getElementById("hud-vote-left");
const hudVoteRight = document.getElementById("hud-vote-right");
const hudVoteShoot = document.getElementById("hud-vote-shoot");
const hudResult = document.getElementById("hud-result");
const hudStatus = document.getElementById("hud-status");

const voteCollector = new VoteCollector();
const assetManager = new AssetManager();
const currentMapId = DEFAULT_MAP_ID;
const currentMap = getDefaultMap();

const engine = new TurnEngine({
  initialState: createInitialState(currentMapId),
  turnMs: 2000,
  voteCollector,
});

const renderer = new CanvasRenderer(canvas, assetManager);

// Input adapter: keyboard -> votes
const keyboard = createKeyboardAdapter({ userId: "local" });
const ACTION_CHOICES = ["FORWARD", "LEFT", "RIGHT", "SHOOT"];
const ACTION_PRIORITY = ["FORWARD", "LEFT", "RIGHT", "SHOOT"];
const voteStats = {
  countsByAction: Object.fromEntries(ACTION_CHOICES.map((action) => [action, 0])),
  votesByUser: new Map(),
  totalVotes: 0,
};
let queuedPreview = null;
let queuedActionLabel = null;
let lastOutcomeRef = null;
let turnNumber = 1;
const overlayState = {};
keyboard.start((vote) => {
  if (engine.state.mode !== "playing") return;
  if (engine.state.result) return;
  if (!vote?.userId) return;

  const actionChoice = normalizeVoteChoice(vote.choice);
  if (!actionChoice) return;

  updateVoteStats({ userId: vote.userId, action: actionChoice, weight: vote.weight ?? 1 });
  updateQueuedFromVotes();

  const internalChoice = actionToInternalChoice(actionChoice);
  if (!internalChoice) return;
  voteCollector.addVote({ ...vote, choice: internalChoice });
});

if (startButton) {
  startButton.addEventListener("click", () => {
    engine.reset(createInitialState(currentMapId));
    startPlaying();
  });
}

preloadMapAssets(currentMap);
engine.state.mode = "start";
syncUi();

function frame() {
  engine.update();
  if (engine.state.result && engine.state.resultAtMs) {
    const elapsedMs = performance.now() - engine.state.resultAtMs;
    if (elapsedMs >= 2000) {
      returnToStart();
    }
  }
  if (engine.lastOutcome && engine.lastOutcome !== lastOutcomeRef) {
    lastOutcomeRef = engine.lastOutcome;
    turnNumber += 1;
    resetTurnUi();
  }

  renderer.render({
    state: engine.state,
    map: currentMap,
    queuedPreview,
  });

  syncUi();
  updateOverlayUI(buildOverlayState());
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

function preloadMapAssets(map) {
  const urls = [
    map.theme?.assets?.background?.image,
    ...(map.theme?.assets?.tiles?.variants ?? []),
    ...(Object.values(map.theme?.assets?.blocked?.kinds ?? {})),
    ...(Object.values(map.theme?.assets?.ship ?? {})),
  ];
  assetManager.loadAll(urls);
}

function voteToPreviewAction(choice) {
  if (choice === "SHOOT") return null;
  const move = actionToInternalChoice(choice);
  if (!move) return null;
  return { type: "move", move };
}

function normalizeVoteChoice(choice) {
  if (typeof choice !== "string") return null;
  const normalized = choice.toUpperCase();
  if (ACTION_CHOICES.includes(normalized)) return normalized;
  if (normalized === "F") return "FORWARD";
  if (normalized === "L") return "LEFT";
  if (normalized === "R") return "RIGHT";
  if (normalized === "SHOOT") return "SHOOT";
  return null;
}

function actionToInternalChoice(action) {
  if (action === "FORWARD") return "F";
  if (action === "LEFT") return "L";
  if (action === "RIGHT") return "R";
  if (action === "SHOOT") return "SHOOT";
  return null;
}

function resetVoteStats() {
  for (const action of ACTION_CHOICES) {
    voteStats.countsByAction[action] = 0;
  }
  voteStats.votesByUser.clear();
  voteStats.totalVotes = 0;
}

function updateVoteStats({ userId, action, weight }) {
  const existing = voteStats.votesByUser.get(userId);
  if (existing) {
    voteStats.countsByAction[existing.action] -= existing.weight;
    voteStats.totalVotes -= existing.weight;
  }
  voteStats.votesByUser.set(userId, { action, weight });
  voteStats.countsByAction[action] += weight;
  voteStats.totalVotes += weight;
}

function getLeadingAction(countsByAction) {
  let best = null;
  let bestScore = 0;
  for (const action of ACTION_PRIORITY) {
    const score = countsByAction[action] ?? 0;
    if (score > bestScore) {
      best = action;
      bestScore = score;
    }
  }
  return best;
}

function updateQueuedFromVotes() {
  const leadingAction = getLeadingAction(voteStats.countsByAction);
  queuedActionLabel = leadingAction;
  queuedPreview = voteToPreviewAction(leadingAction);
}

function getVoteStatsSummary() {
  return {
    countsByAction: { ...voteStats.countsByAction },
    uniqueVoters: voteStats.votesByUser.size,
    totalVotes: voteStats.totalVotes,
  };
}

if (quitButton) {
  quitButton.addEventListener("click", () => {
    returnToStart();
  });
}

function resetTurnUi() {
  queuedPreview = null;
  queuedActionLabel = null;
  resetVoteStats();
  voteCollector.reset();
}

function startPlaying() {
  engine.state.mode = "playing";
  engine.state.queuedAction = null;
  engine.state.result = null;
  engine.state.resultAtMs = null;
  turnNumber = 1;
  resetTurnUi();
}

function returnToStart() {
  engine.reset(createInitialState(currentMapId));
  engine.state.mode = "start";
  engine.state.queuedAction = null;
  engine.state.result = null;
  engine.state.resultAtMs = null;
  turnNumber = 1;
  resetTurnUi();
}

function syncUi() {
  if (engine.state.mode !== "playing") {
    queuedPreview = null;
    queuedActionLabel = null;
  }
  if (startButton) {
    startButton.style.display = engine.state.mode === "start" ? "inline-block" : "none";
  }
  if (quitButton) {
    quitButton.style.display = engine.state.mode === "playing" ? "inline-block" : "none";
  }
  if (canvas) {
    canvas.style.opacity = engine.state.mode === "playing" ? "1" : "0.4";
  }
}

function buildOverlayState() {
  const isPlaying = engine.state.mode === "playing";
  const msLeft = Math.max(0, engine.msLeft());
  const countdownText = `${(msLeft / 1000).toFixed(1)}s`;
  const phase = computePhase({ isPlaying, msLeft });
  const queuedText = queuedActionLabel ?? "none";
  const votes = getVoteStatsSummary();
  const resultText = engine.state.result === "win"
    ? "YOU WIN"
    : engine.state.result === "loss"
      ? "YOU LOSE"
      : "";

  return {
    isPlaying,
    turnNumber,
    phase,
    countdownText,
    positionText: `Pos: (${engine.state.ship.x}, ${engine.state.ship.y})`,
    ammoText: `Ammo: ${engine.state.ship.ammo}`,
    queuedText,
    participantsText: `${votes.uniqueVoters}`,
    votes,
    resultText,
  };
}

function computePhase({ isPlaying, msLeft }) {
  if (!isPlaying) return "Waiting for start";
  if (engine.state.result) return "Result";
  if (msLeft <= 200) return "Locked";
  if (queuedActionLabel) return "Queued";
  return "Collecting";
}

function updateOverlayUI(nextState) {
  if (!hudOverlay) return;
  if (overlayState.isPlaying !== nextState.isPlaying) {
    hudOverlay.style.opacity = nextState.isPlaying ? "1" : "0.9";
    overlayState.isPlaying = nextState.isPlaying;
  }
  updateText(hudTurn, overlayState, "turnNumber", nextState.turnNumber);
  updateText(hudPhase, overlayState, "phase", nextState.phase);
  updateText(hudCountdown, overlayState, "countdownText", `Next action in: ${nextState.countdownText}`);
  updateText(hudPosition, overlayState, "positionText", nextState.positionText);
  updateText(hudAmmo, overlayState, "ammoText", nextState.ammoText);
  updateText(hudQueued, overlayState, "queuedText", nextState.queuedText);
  updateText(hudParticipants, overlayState, "participantsText", nextState.participantsText);
  updateText(hudVoteForward, overlayState, "voteForward", nextState.votes.countsByAction.FORWARD);
  updateText(hudVoteLeft, overlayState, "voteLeft", nextState.votes.countsByAction.LEFT);
  updateText(hudVoteRight, overlayState, "voteRight", nextState.votes.countsByAction.RIGHT);
  updateText(hudVoteShoot, overlayState, "voteShoot", nextState.votes.countsByAction.SHOOT);

  if (hudResult) {
    const isResultVisible = Boolean(nextState.resultText);
    if (overlayState.resultText !== nextState.resultText) {
      hudResult.textContent = nextState.resultText || "";
      overlayState.resultText = nextState.resultText;
    }
    hudResult.classList.toggle("is-visible", isResultVisible);
  }
  if (hudStatus) {
    const shouldShowStatus = !nextState.isPlaying;
    if (overlayState.statusText !== nextState.phase) {
      hudStatus.textContent = nextState.phase;
      overlayState.statusText = nextState.phase;
    }
    hudStatus.classList.toggle("is-visible", shouldShowStatus);
  }
}

function updateText(element, stateCache, key, value) {
  if (!element) return;
  if (stateCache[key] === value) return;
  element.textContent = value;
  stateCache[key] = value;
}
