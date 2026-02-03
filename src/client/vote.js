import { createWsClient } from "./wsClient.js";

const voterName = document.getElementById("voter-name");
const voteTurn = document.getElementById("vote-turn");
const votePhase = document.getElementById("vote-phase");
const voteCountdown = document.getElementById("vote-countdown");
const voteForward = document.getElementById("vote-forward");
const voteLeft = document.getElementById("vote-left");
const voteRight = document.getElementById("vote-right");
const voteShoot = document.getElementById("vote-shoot");
const voteParticipants = document.getElementById("vote-participants");
const voteQueued = document.getElementById("vote-queued");
const voteMessage = document.getElementById("vote-message");
const buttons = Array.from(document.querySelectorAll("button[data-action]"));

const params = new URLSearchParams(window.location.search);
const name = params.get("name");

if (!name) {
  voterName.textContent = "-";
  voteMessage.textContent = "Missing ?name=. Example: /vote?name=alice";
  voteMessage.classList.add("error");
  buttons.forEach((button) => {
    button.disabled = true;
  });
} else {
  voterName.textContent = name;
}

let currentPhase = "voting";

createWsClient({
  onState: (snapshot) => {
    voteTurn.textContent = snapshot.turn;
    votePhase.textContent = snapshot.phase;
    voteCountdown.textContent = `${(Math.max(0, snapshot.countdownMs) / 1000).toFixed(1)}s`;
    voteForward.textContent = snapshot.votes.countsByAction.FORWARD;
    voteLeft.textContent = snapshot.votes.countsByAction.LEFT;
    voteRight.textContent = snapshot.votes.countsByAction.RIGHT;
    voteShoot.textContent = snapshot.votes.countsByAction.SHOOT;
    voteParticipants.textContent = snapshot.votes.uniqueVoters;
    voteQueued.textContent = snapshot.queuedAction ?? "none";

    currentPhase = snapshot.phase;
    updateButtonState();
    updateMessage();
  },
  onStatus: (status) => {
    if (status !== "connected") {
      voteMessage.textContent = status === "disconnected" ? "Disconnected" : "Connecting";
    } else {
      updateMessage();
    }
  },
});

buttons.forEach((button) => {
  button.addEventListener("click", async () => {
    if (!name) return;
    const action = button.dataset.action;
    if (!action) return;
    if (currentPhase !== "voting") return;

    try {
      const response = await fetch("/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, action }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        voteMessage.textContent = payload?.message ?? "Vote rejected";
        return;
      }
      voteMessage.textContent = `Voted ${action}`;
      voteMessage.classList.remove("error");
    } catch (error) {
      voteMessage.textContent = "Vote failed";
      voteMessage.classList.add("error");
    }
  });
});

function updateButtonState() {
  const disabled = !name || currentPhase !== "voting";
  buttons.forEach((button) => {
    button.disabled = disabled;
  });
}

function updateMessage() {
  if (!name) return;
  if (currentPhase === "locked") {
    voteMessage.textContent = "Voting locked for this turn";
    return;
  }
  if (currentPhase === "resolving") {
    voteMessage.textContent = "Resolving turn";
    return;
  }
  voteMessage.textContent = "Cast your vote";
}
