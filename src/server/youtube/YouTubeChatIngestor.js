const DEFAULT_RESOLVE_INTERVAL_MS = 15000;
const DEFAULT_POLL_INTERVAL_MS = 5000;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

const ACTION_TOKENS = new Map([
  ["forward", "FORWARD"],
  ["f", "FORWARD"],
  ["⬆", "FORWARD"],
  ["⬆️", "FORWARD"],
  ["left", "LEFT"],
  ["l", "LEFT"],
  ["⬅", "LEFT"],
  ["⬅️", "LEFT"],
  ["right", "RIGHT"],
  ["r", "RIGHT"],
  ["➡", "RIGHT"],
  ["➡️", "RIGHT"],
  ["shoot", "SHOOT"],
  ["s", "SHOOT"],
  ["🔫", "SHOOT"],
  ["💥", "SHOOT"],
]);

export function parseVoteAction(text) {
  if (!text) return null;
  const normalized = String(text).trim().toLowerCase();
  return ACTION_TOKENS.get(normalized) ?? null;
}

function buildYouTubeUrl(endpoint, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, value);
  }
  return url;
}

function formatError(error) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  return error.message ?? String(error);
}

export class YouTubeChatIngestor {
  constructor({
    apiKey,
    videoId,
    source,
    castVote,
    getTurnId,
    logger = console,
    resolveIntervalMs = DEFAULT_RESOLVE_INTERVAL_MS,
  }) {
    this.apiKey = apiKey;
    this.videoId = videoId;
    this.source = source;
    this.castVote = castVote;
    this.getTurnId = getTurnId;
    this.logger = logger;
    this.resolveIntervalMs = resolveIntervalMs;

    this.liveChatId = null;
    this.nextPageToken = null;
    this.lastMessageAt = null;
    this.lastPollAt = null;
    this.lastError = null;
    this.lastPollingIntervalMs = null;

    this.running = false;
    this.timer = null;
    this.backoffMs = INITIAL_BACKOFF_MS;
    this.loggedMissingChat = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.schedule(0);
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  getStatus() {
    return {
      source: this.source,
      videoId: this.videoId,
      liveChatId: this.liveChatId,
      lastMessageAt: this.lastMessageAt,
      lastPollAt: this.lastPollAt,
      lastError: this.lastError,
    };
  }

  schedule(delayMs) {
    if (!this.running) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.loop(), delayMs);
  }

  async loop() {
    if (!this.running) return;

    if (!this.liveChatId) {
      await this.resolveChatId();
      this.schedule(this.resolveIntervalMs);
      return;
    }

    try {
      await this.pollMessages();
      this.backoffMs = INITIAL_BACKOFF_MS;
      const delay = this.lastPollingIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
      this.schedule(delay);
    } catch (error) {
      const message = formatError(error);
      this.lastError = message;
      this.logger.warn(`[YouTube] ${this.source} poll failed: ${message}`);
      this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
      this.schedule(this.backoffMs);
    }
  }

  async resolveChatId() {
    try {
      const url = buildYouTubeUrl("liveBroadcasts", {
        part: "snippet",
        id: this.videoId,
        key: this.apiKey,
      });
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`liveBroadcasts.list ${response.status}`);
      }
      const data = await response.json();
      const chatId = data?.items?.[0]?.snippet?.liveChatId ?? null;
      if (!chatId) {
        if (!this.loggedMissingChat) {
          this.logger.warn(
            `[YouTube] ${this.source} no liveChatId for video ${this.videoId}. Retrying...`,
          );
          this.loggedMissingChat = true;
        }
        this.lastError = "Live chat not available";
        return;
      }

      if (this.liveChatId !== chatId) {
        this.logger.info(`[YouTube] ${this.source} liveChatId resolved.`);
      }

      this.liveChatId = chatId;
      this.nextPageToken = null;
      this.loggedMissingChat = false;
      this.lastError = null;
    } catch (error) {
      const message = formatError(error);
      this.lastError = message;
      if (!this.loggedMissingChat) {
        this.logger.warn(`[YouTube] ${this.source} resolve failed: ${message}`);
        this.loggedMissingChat = true;
      }
    }
  }

  async pollMessages() {
    const url = buildYouTubeUrl("liveChatMessages", {
      liveChatId: this.liveChatId,
      part: "snippet,authorDetails",
      key: this.apiKey,
      pageToken: this.nextPageToken,
    });

    this.lastPollAt = new Date().toISOString();
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        this.liveChatId = null;
      }
      throw new Error(`liveChatMessages.list ${response.status}`);
    }

    const data = await response.json();
    this.lastPollingIntervalMs = Number(data?.pollingIntervalMillis) || DEFAULT_POLL_INTERVAL_MS;
    this.nextPageToken = data?.nextPageToken ?? null;
    this.lastError = null;

    const items = Array.isArray(data?.items) ? data.items : [];
    for (const item of items) {
      const message = item?.snippet?.displayMessage ?? "";
      const action = parseVoteAction(message);
      if (!action) continue;

      const author = item?.authorDetails ?? {};
      const voterKey = author.channelId || author.displayName;
      if (!voterKey) continue;

      this.castVote({
        turnId: this.getTurnId(),
        voterKey,
        displayName: author.displayName ?? voterKey,
        action,
        source: this.source,
      });

      this.lastMessageAt = item?.snippet?.publishedAt ?? new Date().toISOString();
    }
  }
}
