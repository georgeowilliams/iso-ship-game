import { CanvasRenderer } from "../render/renderer.js";
import { AssetManager } from "../render/assetManager.js";
import { getMapById } from "../maps/maps.js";
import { createWsClient } from "./wsClient.js";

const canvas = document.getElementById("game");
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

const assetManager = new AssetManager();
const renderer = new CanvasRenderer(canvas, assetManager);

let currentMap = null;
let latestState = null;
let queuedPreview = null;
let overlayState = {};
let connectionStatus = "connecting";
let timeOffsetMs = 0;
let hasTimeOffset = false;

const ACTION_TO_MOVE = {
  FORWARD: "F",
  LEFT: "L",
  RIGHT: "R",
};

createWsClient({
  onState: (snapshot) => {
    latestState = snapshot.state;
    connectionStatus = "connected";
    ensureMap(latestState.mapId);
    queuedPreview = voteToPreviewAction(snapshot.queuedAction);
    if (!hasTimeOffset && Number.isFinite(snapshot.serverNowMs)) {
      timeOffsetMs = performance.now() - snapshot.serverNowMs;
      renderer.setTimeOffsetMs(timeOffsetMs);
      hasTimeOffset = true;
    }
    updateOverlayUI(snapshot);
  },
  onStatus: (status) => {
    connectionStatus = status;
    updateStatusBanner();
  },
});

function ensureMap(mapId) {
  if (!mapId) return;
  if (currentMap?.id === mapId) return;
  currentMap = getMapById(mapId);
  preloadMapAssets(currentMap);
}

function preloadMapAssets(map) {
  if (!map) return;
  const urls = [
    map.theme?.assets?.background?.image,
    ...(map.theme?.assets?.tiles?.variants ?? []),
    ...(Object.values(map.theme?.assets?.blocked?.kinds ?? {})),
    ...(Object.values(map.theme?.assets?.ship ?? {})),
  ];
  assetManager.loadAll(urls);
}

function voteToPreviewAction(actionLabel) {
  if (!actionLabel || actionLabel === "SHOOT") return null;
  const move = ACTION_TO_MOVE[actionLabel];
  if (!move) return null;
  return { type: "move", move };
}

function updateOverlayUI(snapshot) {
  if (!snapshot) return;
  const { turn, phase, countdownMs, votes, queuedAction, state } = snapshot;
  const countdownText = `${(Math.max(0, countdownMs) / 1000).toFixed(1)}s`;
  const resultText = state.result === "win"
    ? "YOU WIN"
    : state.result === "loss"
      ? "YOU LOSE"
      : "";

  updateText(hudTurn, overlayState, "turnNumber", turn);
  updateText(hudPhase, overlayState, "phase", phase);
  updateText(hudCountdown, overlayState, "countdownText", `Next action in: ${countdownText}`);
  updateText(hudPosition, overlayState, "positionText", `Pos: (${state.ship.x}, ${state.ship.y})`);
  updateText(hudAmmo, overlayState, "ammoText", `Ammo: ${state.ship.ammo}`);
  updateText(hudQueued, overlayState, "queuedText", queuedAction ?? "none");
  updateText(hudParticipants, overlayState, "participantsText", `${votes.uniqueVoters}`);
  updateText(hudVoteForward, overlayState, "voteForward", votes.countsByAction.FORWARD);
  updateText(hudVoteLeft, overlayState, "voteLeft", votes.countsByAction.LEFT);
  updateText(hudVoteRight, overlayState, "voteRight", votes.countsByAction.RIGHT);
  updateText(hudVoteShoot, overlayState, "voteShoot", votes.countsByAction.SHOOT);

  if (hudResult) {
    const isResultVisible = Boolean(resultText);
    if (overlayState.resultText !== resultText) {
      hudResult.textContent = resultText || "";
      overlayState.resultText = resultText;
    }
    hudResult.classList.toggle("is-visible", isResultVisible);
  }

  updateStatusBanner();
}

function updateStatusBanner() {
  if (!hudStatus) return;
  let message = "";
  if (connectionStatus !== "connected") {
    message = connectionStatus === "disconnected" ? "Disconnected" : "Connecting";
  } else if (!latestState) {
    message = "Waiting for server";
  }
  const show = Boolean(message);
  hudStatus.textContent = message;
  hudStatus.classList.toggle("is-visible", show);
}

function updateText(element, stateCache, key, value) {
  if (!element) return;
  if (stateCache[key] === value) return;
  element.textContent = value;
  stateCache[key] = value;
}

function frame() {
  if (latestState) {
    renderer.render({ state: latestState, map: currentMap, queuedPreview });
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
