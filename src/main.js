import { createInitialState } from "./core/state.js";
import { TurnEngine } from "./core/turnEngine.js";
import { VoteCollector } from "./core/voteCollector.js";
import { CanvasRenderer } from "./render/renderer.js";
import { AssetManager } from "./render/assetManager.js";
import { createKeyboardAdapter } from "./input/keyboard.js";
import { MAPS, getMapById } from "./maps/maps.js";

const canvas = document.getElementById("game");
const mapSelect = document.getElementById("map-select");

const voteCollector = new VoteCollector();
const assetManager = new AssetManager();
let currentMap = MAPS[0];


const engine = new TurnEngine({
  initialState: createInitialState(currentMap),
  turnMs: 2000,
  voteCollector,
});

const renderer = new CanvasRenderer(canvas, assetManager);

// Input adapter: keyboard -> votes
const keyboard = createKeyboardAdapter({ userId: "local" });
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

function frame() {
  engine.update();

  renderer.render({
    state: engine.state,
    msLeft: engine.msLeft(),
    lastMoveSteps: engine.lastMoveSteps,
    map: currentMap,
  });

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

function preloadMapAssets(map) {
  const urls = [
    map.theme?.assets?.background?.image,
    ...(map.theme?.assets?.tiles?.variants ?? []),
    ...(Object.values(map.theme?.assets?.blocked?.kinds ?? {})),
  ];
  assetManager.loadAll(urls);
}
