import { DIR_V } from "../core/constants.js";
import { computeMoveSteps, inBounds, makeBlockedMap, isBlocked } from "../core/rules.js";
import { gridToIsoTop, tileCenter, computeGridCorners, computeOrigin } from "./iso.js";
import { clamp01, lerp } from "../util/math.js";

export class CanvasRenderer {
  constructor(canvas, assetManager = null) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.assetManager = assetManager;
  }

  render({ state, msLeft, lastMoveSteps, map, queuedPreview, queuedActionLabel, voteStats }) {
    const ctx = this.ctx;
    const { width, height } = this.canvas;

    ctx.clearRect(0, 0, width, height);

    const theme = state.theme?.assets ?? map?.theme?.assets;
    const backgroundImage = theme?.background?.image;
    const bg = backgroundImage ? this.assetManager?.get(backgroundImage) : null;
    if (bg) {
      ctx.drawImage(bg, 0, 0, width, height);
    } else {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
    }

    // tile sizing tuned for big canvas
    const tileW = Math.floor(Math.min(width, height) / (state.cols + state.rows) * 1.85);
    const tileH = Math.floor(tileW / 2);

    const { originX, originY, pad } = computeOrigin(state, width, height, tileW, tileH);
    const blockedMap = makeBlockedMap(state.blocked);
    const tileVariants = theme?.tiles?.variants ?? [];
    const blockedKinds = theme?.blocked?.kinds ?? {};

    // --- tiles ---
    for (let gy = 0; gy < state.rows; gy++) {
      for (let gx = 0; gx < state.cols; gx++) {
        const { sx, sy } = gridToIsoTop(gx, gy, originX, originY, tileW, tileH);
        if (tileVariants.length > 0) {
          const tileIndex = tileVariantIndex(state.mapSeed ?? 0, gx, gy, tileVariants.length);
          const tileUrl = tileVariants[tileIndex];
          const tileImage = this.assetManager?.get(tileUrl);
          if (tileImage) {
            drawTileImage(ctx, tileImage, sx, sy, tileW, tileH);
          } else {
            drawDiamond(ctx, sx, sy, tileW, tileH, "#f2f2f2");
          }
        } else {
          drawDiamond(ctx, sx, sy, tileW, tileH, "#f2f2f2");
        }

        if (isBlocked(blockedMap, gx, gy)) {
          const kind = blockedMap.get(`${gx},${gy}`);
          const blockedUrl = blockedKinds[kind] ?? blockedKinds.fallback;
          const blockedImage = this.assetManager?.get(blockedUrl);
          if (blockedImage) {
            drawTileImage(ctx, blockedImage, sx, sy, tileW, tileH);
          } else {
            drawDiamond(ctx, sx, sy, tileW, tileH, "#000");
          }
        }
      }
    }

    // --- highlights ---
    // previous tile
    drawHighlight(ctx, state, state.prev.x, state.prev.y, originX, originY, tileW, tileH, "rgba(0,180,255,0.18)");

    // queued target & step1
    const pendingAction = queuedPreview ?? state.queuedAction;
    if (pendingAction?.type === "move") {
      const { steps } = computeMoveSteps(state.ship.x, state.ship.y, state.ship.dir, pendingAction.move);

      if (steps.length === 2) {
        const s1 = steps[0];
        let tint1 = "rgba(255,255,0,0.12)";
        if (!inBounds(state, s1.x, s1.y)) tint1 = "rgba(255,165,0,0.18)";
        else if (isBlocked(blockedMap, s1.x, s1.y)) tint1 = "rgba(255,0,0,0.20)";
        drawHighlight(ctx, state, s1.x, s1.y, originX, originY, tileW, tileH, tint1);
      }

      if (steps.length >= 1) {
        const last = steps[steps.length - 1];
        let tint = "rgba(0,255,0,0.18)";
        if (!inBounds(state, last.x, last.y)) tint = "rgba(255,165,0,0.18)";
        else if (isBlocked(blockedMap, last.x, last.y)) tint = "rgba(255,0,0,0.20)";
        drawHighlight(ctx, state, last.x, last.y, originX, originY, tileW, tileH, tint);
      }
    }

    // --- projectile path highlights ---
    for (const p of state.projectiles) {
      const t = clamp01((performance.now() - p.spawnTime) / p.durationMs);
      if (t >= 1) continue;
      if (!Array.isArray(p.path)) continue;
      p.path.forEach((tile, idx) => {
        const tint = idx === 0 ? "rgba(255,140,0,0.25)" : "rgba(255,140,0,0.14)";
        drawHighlight(ctx, state, tile.x, tile.y, originX, originY, tileW, tileH, tint);
      });
    }

    // --- projectiles (visual only) ---
    for (const p of state.projectiles) {
      const t = clamp01((performance.now() - p.spawnTime) / p.durationMs);
      if (t >= 1) continue;
      const from = tileCenter(p.fromX, p.fromY, originX, originY, tileW, tileH);
      const to = tileCenter(p.toX, p.toY, originX, originY, tileW, tileH);

      const x = lerp(from.x, to.x, t);
      const y = lerp(from.y, to.y, t) - Math.sin(t * Math.PI) * (tileH * 0.25);

      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(x, y, Math.max(3, tileH * 0.10), 0, Math.PI * 2);
      ctx.fill();
    }

    // --- ship ---
    const shipC = tileCenter(state.ship.x, state.ship.y, originX, originY, tileW, tileH);
    const r = Math.max(10, tileH * 0.30);
    const dirKey = ["N", "E", "S", "W"][state.ship.dir] ?? "N";
    const shipSprite = theme?.ship?.[dirKey];
    const shipImage = shipSprite ? this.assetManager?.get(shipSprite) : null;

    if (shipImage) {
      drawShipSprite(ctx, shipImage, shipC.x, shipC.y, tileW, tileH);
    } else {
      const flash = (performance.now() - state.lastDamageAt) < 220;
      ctx.fillStyle = flash ? "#5a0c0c" : "#111";
      ctx.beginPath();
      ctx.arc(shipC.x, shipC.y, r, 0, Math.PI * 2);
      ctx.fill();

      // pointer triangle BLACK, iso-correct (uses projected forward tile direction)
      const f = getForwardScreenUnit(state, originX, originY, tileW, tileH);
      drawPointer(ctx, shipC.x, shipC.y, r, f.dx, f.dy);
    }

    // compass outside corners
    drawCompassOutside(ctx, state, originX, originY, tileW, tileH, pad);

    // HUD
    ctx.fillStyle = "#111";
    ctx.font = "18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`NEXT ACTION IN: ${(Math.max(0, msLeft) / 1000).toFixed(1)}s`, 16, 34);

    ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const dirName = ["N", "E", "S", "W"][state.ship.dir];
    ctx.fillText(`pos: (${state.ship.x}, ${state.ship.y})  facing: ${dirName}`, 16, 62);
    ctx.fillText(`HP: ${state.ship.hp}   AMMO: ${state.ship.ammo}`, 16, 88);

    if (state.mode === "playing") {
      const hud = voteStats ?? {
        countsByAction: { FORWARD: 0, LEFT: 0, RIGHT: 0, SHOOT: 0 },
        uniqueVoters: 0,
        totalVotes: 0,
      };
      const queuedLabel = queuedActionLabel ?? "none";
      let y = 114;
      ctx.fillText(`Queued: ${queuedLabel}`, 16, y);
      y += 20;
      ctx.fillText(`Participants: ${hud.uniqueVoters}`, 16, y);
      y += 18;
      ctx.fillText(`FORWARD: ${hud.countsByAction.FORWARD}`, 16, y);
      y += 18;
      ctx.fillText(`LEFT: ${hud.countsByAction.LEFT}`, 16, y);
      y += 18;
      ctx.fillText(`RIGHT: ${hud.countsByAction.RIGHT}`, 16, y);
      y += 18;
      ctx.fillText(`SHOOT: ${hud.countsByAction.SHOOT}`, 16, y);
    }

    ctx.font = "13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const controlsY = state.mode === "playing" ? 260 : 140;
    ctx.fillText(`controls: W/↑=Forward, A/←=F+Left, D/→=F+Right | space=shoot`, 16, controlsY);
  }
}

function drawDiamond(ctx, sx, sy, tileW, tileH, fillStyle) {
  const halfW = tileW / 2;
  const halfH = tileH / 2;

  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + halfW, sy + halfH);
  ctx.lineTo(sx, sy + tileH);
  ctx.lineTo(sx - halfW, sy + halfH);
  ctx.closePath();

  ctx.fillStyle = fillStyle;
  ctx.fill();

  ctx.strokeStyle = "#222";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawTileImage(ctx, image, sx, sy, tileW, tileH) {
  const x = sx - tileW / 2;
  const y = sy;
  ctx.drawImage(image, x, y, tileW, tileH);
}

function drawShipSprite(ctx, image, cx, cy, tileW, tileH) {
  const w = tileW * 0.9;
  const h = tileH * 0.9;
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.drawImage(image, x, y, w, h);
}

function drawHighlight(ctx, state, gx, gy, originX, originY, tileW, tileH, rgba) {
  if (gx < 0 || gx >= state.cols || gy < 0 || gy >= state.rows) return;

  const { sx, sy } = gridToIsoTop(gx, gy, originX, originY, tileW, tileH);
  const halfW = tileW / 2;
  const halfH = tileH / 2;

  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + halfW, sy + halfH);
  ctx.lineTo(sx, sy + tileH);
  ctx.lineTo(sx - halfW, sy + halfH);
  ctx.closePath();

  ctx.fillStyle = rgba;
  ctx.fill();
}

function tileVariantIndex(seed, x, y, count) {
  const h1 = (seed ^ (x * 374761393) ^ (y * 668265263)) >>> 0;
  return h1 % count;
}

function getForwardScreenUnit(state, originX, originY, tileW, tileH) {
  const v = DIR_V[state.ship.dir];
  const c0 = tileCenter(state.ship.x, state.ship.y, originX, originY, tileW, tileH);
  const c1 = tileCenter(state.ship.x + v.x, state.ship.y + v.y, originX, originY, tileW, tileH);
  let dx = c1.x - c0.x;
  let dy = c1.y - c0.y;
  const len = Math.hypot(dx, dy) || 1;
  return { dx: dx / len, dy: dy / len };
}

function drawPointer(ctx, cx, cy, r, dx, dy) {
  // BLACK pointer projected forward from the circle
  const noseDist = r * 1.25;
  const tipDist = r * 2.15;

  const baseCX = cx + dx * noseDist;
  const baseCY = cy + dy * noseDist;
  const tipX = cx + dx * tipDist;
  const tipY = cy + dy * tipDist;

  const perpX = -dy;
  const perpY = dx;
  const baseHalfW = r * 0.52;

  const b1x = baseCX + perpX * baseHalfW;
  const b1y = baseCY + perpY * baseHalfW;
  const b2x = baseCX - perpX * baseHalfW;
  const b2y = baseCY - perpY * baseHalfW;

  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(b1x, b1y);
  ctx.lineTo(b2x, b2y);
  ctx.closePath();
  ctx.fill();
}

function drawCompassOutside(ctx, state, originX, originY, tileW, tileH) {
  const { topCorner, rightCorner, bottomCorner, leftCorner } =
    computeGridCorners(state, originX, originY, tileW, tileH);

  const off = Math.max(18, Math.floor(tileW * 0.22));

  const center = {
    x: (topCorner.x + rightCorner.x + bottomCorner.x + leftCorner.x) / 4,
    y: (topCorner.y + rightCorner.y + bottomCorner.y + leftCorner.y) / 4,
  };

  const edgeMid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const outward = (p) => {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * off, y: p.y + (dy / len) * off };
  };

  const northEdge = edgeMid(topCorner, rightCorner);
  const eastEdge = edgeMid(rightCorner, bottomCorner);
  const southEdge = edgeMid(bottomCorner, leftCorner);
  const westEdge = edgeMid(leftCorner, topCorner);

  const Np = outward(northEdge);
  const Ep = outward(eastEdge);
  const Sp = outward(southEdge);
  const Wp = outward(westEdge);

  ctx.fillStyle = "#000";
  ctx.font = "bold 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText("N", Np.x, Np.y);
  ctx.fillText("E", Ep.x, Ep.y);
  ctx.fillText("S", Sp.x, Sp.y);
  ctx.fillText("W", Wp.x, Wp.y);

  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}
