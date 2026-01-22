import { createInitialState } from "./core/state.js";
import { TurnEngine } from "./core/turnEngine.js";
import { VoteCollector } from "./core/voteCollector.js";
import { CanvasRenderer } from "./render/renderer.js";
import { AssetManager } from "./render/assetManager.js";
import { createKeyboardAdapter } from "./input/keyboard.js";
import { getAllMaps, getMapById } from "./maps/maps.js";

const canvas = document.getElementById("game");
const mapSelect = document.getElementById("map-select");
const startButton = document.getElementById("start-game");

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
let queuedPreview = null;
let lastOutcomeRef = null;
keyboard.start((vote) => {
  if (engine.state.mode !== "playing") return;
  queuedPreview = voteToPreviewAction(vote.choice);
  voteCollector.addVote(vote);
});
keyboard.start((vote) => voteCollector.addVote(vote));

if (mapSelect) {
  for (const map of MAPS) {
    const option = document.createElement("option");
    option.value = map.id;
    option.textContent = map.name;
    mapSelect.appendChild(option);
  }
  mapSelect.value = currentMap.id;
  mapSelect.addEventListener("change", () => {
    currentMap = getMapById(mapSelect.value);
    engine.loadMap(currentMap);
    preloadMapAssets(currentMap);
  });
}

preloadMapAssets(currentMap);

if (mapSelect) {
  for (const map of MAPS) {
    const option = document.createElement("option");
    option.value = map.id;
    option.textContent = map.name;
    mapSelect.appendChild(option);
  }
  mapSelect.value = currentMap.id;
  mapSelect.addEventListener("change", () => {
    currentMap = getMapById(mapSelect.value);
    engine.loadMap(currentMap);
    preloadMapAssets(currentMap);
  });
}

preloadMapAssets(currentMap);

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
    preloadMapAssets(currentMap);
  });
}

if (startButton) {
  startButton.addEventListener("click", () => {
    if (!mapSelect) return;
    currentMap = getMapById(mapSelect.value);
    engine.loadMap(currentMap);
    engine.state.mode = "playing";
    queuedPreview = null;
  });
}

preloadMapAssets(currentMap);
engine.state.mode = "mapSelect";
syncUi();

function frame() {
  engine.update();
  if (engine.lastOutcome && engine.lastOutcome !== lastOutcomeRef) {
    lastOutcomeRef = engine.lastOutcome;
    queuedPreview = null;
  }

  renderer.render({
    state: engine.state,
    msLeft: engine.msLeft(),
    lastMoveSteps: engine.lastMoveSteps,
    map: currentMap,
    queuedPreview,
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
  return { type: "move", move: choice };
}

const gameOverOverlay = document.getElementById("game-over");
const restartButton = document.getElementById("restart");
const backButton = document.getElementById("back-to-maps");

if (restartButton) {
  restartButton.addEventListener("click", () => {
    engine.loadMap(engine.state.mapId);
    engine.state.mode = "playing";
    queuedPreview = null;
  });
}

if (backButton) {
  backButton.addEventListener("click", () => {
    engine.state.mode = "mapSelect";
    queuedPreview = null;
  });
}

function syncUi() {
  if (engine.state.mode !== "playing") {
    queuedPreview = null;
  }
  if (mapSelect) {
    mapSelect.disabled = engine.state.mode !== "mapSelect";
  }
  if (startButton) {
    startButton.style.display = engine.state.mode === "mapSelect" ? "inline-block" : "none";
  }
  if (gameOverOverlay) {
    gameOverOverlay.style.display = engine.state.mode === "gameOver" ? "flex" : "none";
  }
}
