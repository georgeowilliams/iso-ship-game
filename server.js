import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { statSync } from "node:fs";
import { performance } from "node:perf_hooks";
import crypto from "node:crypto";
import { TurnEngine } from "./src/core/turnEngine.js";
import { VoteCollector } from "./src/core/voteCollector.js";
import { createInitialState, cloneState } from "./src/core/state.js";
import { getAllMaps, getMapById } from "./src/maps/maps.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 5173;
const LOCK_WINDOW_MS = 200;
const TURN_MS = 2000;

const maps = getAllMaps();
const defaultMap = maps[0];

const voteCollector = new VoteCollector();
const engine = new TurnEngine({
  initialState: createInitialState(defaultMap.id),
  turnMs: TURN_MS,
  voteCollector,
  now: () => performance.now(),
});

let turnNumber = 1;
let lastOutcomeRef = engine.lastOutcome;

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) {
      res.writeHead(400);
      res.end("Bad request");
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "POST" && url.pathname === "/vote") {
      await handleVote(req, res);
      return;
    }

    if (req.method !== "GET") {
      res.writeHead(405);
      res.end("Method not allowed");
      return;
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      await sendFile(res, path.join(__dirname, "index.html"));
      return;
    }
    if (url.pathname === "/shorts") {
      await sendFile(res, path.join(__dirname, "public", "shorts.html"));
      return;
    }
    if (url.pathname === "/live") {
      await sendFile(res, path.join(__dirname, "public", "live.html"));
      return;
    }
    if (url.pathname === "/vote") {
      await sendFile(res, path.join(__dirname, "public", "vote.html"));
      return;
    }

    const filePath = resolveStaticPath(url.pathname);
    if (!filePath) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    await sendFile(res, filePath);
  } catch (error) {
    res.writeHead(500);
    res.end("Server error");
    console.error(error);
  }
});

const clients = new Set();

server.on("upgrade", (req, socket) => {
  const url = new URL(req.url ?? "", `http://${req.headers.host}`);
  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }

  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }

  const accept = crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`, "binary")
    .digest("base64");

  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "\r\n",
  ].join("\r\n"));

  socket.on("data", () => {});
  socket.on("close", () => {
    clients.delete(socket);
  });
  socket.on("end", () => {
    clients.delete(socket);
  });

  clients.add(socket);
  sendWsMessage(socket, JSON.stringify({ type: "state", payload: buildSnapshot() }));
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

setInterval(() => {
  engine.update();
  handleTurnAdvance();
  handleResultReset();
  broadcastSnapshot();
}, 100);

function handleTurnAdvance() {
  if (engine.lastOutcome && engine.lastOutcome !== lastOutcomeRef) {
    lastOutcomeRef = engine.lastOutcome;
    turnNumber += 1;
  }
}

function handleResultReset() {
  if (!engine.state.result || !engine.state.resultAtMs) return;
  const elapsed = performance.now() - engine.state.resultAtMs;
  if (elapsed < 2000) return;
  const mapId = engine.state.mapId ?? defaultMap.id;
  engine.loadMap(getMapById(mapId));
  turnNumber = 1;
  lastOutcomeRef = engine.lastOutcome;
}

function buildSnapshot() {
  const msLeft = Math.max(0, engine.msLeft());
  const phase = engine.state.result
    ? "resolving"
    : msLeft <= LOCK_WINDOW_MS
      ? "locked"
      : "voting";
  const counts = voteCollector.tally();
  const queuedChoice = voteCollector.resolveWinner();

  return {
    state: cloneState(engine.state),
    serverNowMs: performance.now(),
    turn: turnNumber,
    phase,
    countdownMs: msLeft,
    queuedAction: voteChoiceToLabel(queuedChoice),
    votes: {
      countsByAction: {
        FORWARD: counts.F,
        LEFT: counts.L,
        RIGHT: counts.R,
        SHOOT: counts.SHOOT,
      },
      totalVotes: Object.values(counts).reduce((sum, value) => sum + value, 0),
      uniqueVoters: voteCollector.votes.size,
    },
  };
}

function broadcastSnapshot() {
  const payload = JSON.stringify({ type: "state", payload: buildSnapshot() });
  for (const client of clients) {
    sendWsMessage(client, payload);
  }
}

async function handleVote(req, res) {
  const body = await readJson(req);
  if (!body?.name || !body?.action) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Missing name or action" }));
    return;
  }

  const msLeft = Math.max(0, engine.msLeft());
  const phase = engine.state.result
    ? "resolving"
    : msLeft <= LOCK_WINDOW_MS
      ? "locked"
      : "voting";

  if (phase !== "voting") {
    res.writeHead(409, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Voting is locked" }));
    return;
  }

  const choice = actionLabelToVoteChoice(body.action);
  if (!choice) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Invalid action" }));
    return;
  }

  voteCollector.addVote({ userId: body.name, choice, weight: 1 });
  broadcastSnapshot();

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    return null;
  }
}

function actionLabelToVoteChoice(action) {
  const normalized = String(action).toUpperCase();
  if (normalized === "FORWARD") return "F";
  if (normalized === "LEFT") return "L";
  if (normalized === "RIGHT") return "R";
  if (normalized === "SHOOT") return "SHOOT";
  return null;
}

function voteChoiceToLabel(choice) {
  if (choice === "F") return "FORWARD";
  if (choice === "L") return "LEFT";
  if (choice === "R") return "RIGHT";
  if (choice === "SHOOT") return "SHOOT";
  return null;
}

function resolveStaticPath(urlPath) {
  const safePath = decodeURIComponent(urlPath.split("?")[0]);
  if (safePath.includes("..")) return null;
  const relativePath = safePath.replace(/^\/+/, "");

  const candidates = [
    path.join(__dirname, relativePath),
    path.join(__dirname, "public", relativePath),
  ];

  for (const candidate of candidates) {
    if (!candidate.startsWith(__dirname)) continue;
    try {
      const stat = statSync(candidate);
      if (stat.isFile()) return candidate;
    } catch (error) {
      continue;
    }
  }
  return null;
}

async function sendFile(res, filePath) {
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(data);
  } catch (error) {
    res.writeHead(404);
    res.end("Not found");
  }
}

function contentType(filePath) {
  const ext = path.extname(filePath);
  if (ext === ".html") return "text/html";
  if (ext === ".js") return "text/javascript";
  if (ext === ".css") return "text/css";
  if (ext === ".txt") return "text/plain";
  if (ext === ".json") return "application/json";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function sendWsMessage(socket, message) {
  if (!socket.writable) return;
  const payload = Buffer.from(message);
  const length = payload.length;

  let header = null;
  if (length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = length;
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  socket.write(Buffer.concat([header, payload]));
}
