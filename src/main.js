import { createInitialState } from "./core/state.js";
import { TurnEngine } from "./core/turnEngine.js";
import { VoteCollector } from "./core/voteCollector.js";
import { CanvasRenderer } from "./render/renderer.js";
import { AssetManager } from "./render/assetManager.js";
import { createKeyboardAdapter } from "./input/keyboard.js";
import { getAllMaps, getMapById } from "./maps/maps.js";

const canvas = document.getElementById("game");
const startOverlay = document.getElementById("start-overlay");
const mapSelect = document.getElementById("map-select");
const startButton = document.getElementById("start-game");
const quitButton = document.getElementById("quit");

const voteCollector = new VoteCollector();
const assetManager = new AssetManager();
const maps = getAllMaps();
let currentMap = maps[0];

const engine = new TurnEngine({
  initialState: createInitialState(currentMap.id),
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
keyboard.start((vote) => {
  if (engine.state.mode !== "playing") return;
  if (!vote?.userId) return;

  const actionChoice = normalizeVoteChoice(vote.choice);
  if (!actionChoice) return;

  updateVoteStats({ userId: vote.userId, action: actionChoice, weight: vote.weight ?? 1 });
  updateQueuedFromVotes();

  const internalChoice = actionToInternalChoice(actionChoice);
  if (!internalChoice) return;
  voteCollector.addVote({ ...vote, choice: internalChoice });
});

if (mapSelect) {
  for (const map of maps) {
    const option = document.createElement("option");
    option.value = map.id;
    option.textContent = map.name;
    mapSelect.appendChild(option);
  }
  mapSelect.value = currentMap.id;
  mapSelect.addEventListener("change", () => {
    currentMap = getMapById(mapSelect.value);
    engine.loadMap(currentMap);
    engine.state.mode = "start";
    preloadMapAssets(currentMap);
  });
}

if (startButton) {
  startButton.addEventListener("click", () => {
    if (!mapSelect) return;
    currentMap = getMapById(mapSelect.value);
    engine.loadMap(currentMap);
    startPlaying();
  });
}

preloadMapAssets(currentMap);
engine.state.mode = "start";
syncUi();

function frame() {
  engine.update();
  if (engine.state.mode === "gameOver" || (engine.state.mode === "playing" && engine.state.ship.hp <= 0)) {
    returnToStart();
  }
  if (engine.lastOutcome && engine.lastOutcome !== lastOutcomeRef) {
    lastOutcomeRef = engine.lastOutcome;
    resetTurnUi();
  }

  renderer.render({
    state: engine.state,
    msLeft: engine.msLeft(),
    lastMoveSteps: engine.lastMoveSteps,
    map: currentMap,
    queuedPreview,
    queuedActionLabel,
    voteStats: getVoteStatsSummary(),
  });

  syncUi();
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
  resetTurnUi();
}

function returnToStart() {
  engine.state.mode = "start";
  engine.state.queuedAction = null;
  resetTurnUi();
}

function syncUi() {
  if (engine.state.mode !== "playing") {
    queuedPreview = null;
    queuedActionLabel = null;
  }
  if (mapSelect) {
    mapSelect.disabled = engine.state.mode !== "start";
  }
  if (startButton) {
    startButton.style.display = engine.state.mode === "start" ? "inline-block" : "none";
  }
  if (quitButton) {
    quitButton.style.display = engine.state.mode === "playing" ? "inline-block" : "none";
  }
  if (startOverlay) {
    startOverlay.style.display = engine.state.mode === "playing" ? "none" : "flex";
  }
  if (canvas) {
    canvas.style.opacity = engine.state.mode === "playing" ? "1" : "0.4";
  }
}
