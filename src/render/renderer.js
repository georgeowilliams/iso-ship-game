import { DIR_V } from "../core/constants.js";
import { computeMoveSteps, inBounds, makeBlockedSet, isBlocked } from "../core/rules.js";
import { gridToIsoTop, tileCenter, computeGridCorners, computeOrigin } from "./iso.js";
import { clamp01, lerp } from "../util/math.js";

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }

  render({ state, msLeft, lastMoveSteps }) {
    const ctx = this.ctx;
    const { width, height } = this.canvas;

    ctx.clearRect(0, 0, width, height);

    // tile sizing tuned for big canvas
    const tileW = Math.floor(Math.min(width, height) / (state.cols + state.rows) * 1.85);
    const tileH = Math.floor(tileW / 2);

    const { originX, originY, pad } = computeOrigin(state, width, height, tileW, tileH);
    const blockedSet = makeBlockedSet(state.blocked);

    // --- tiles ---
    for (let gy = 0; gy < state.rows; gy++) {
      for (let gx = 0; gx < state.cols; gx++) {
        const { sx, sy } = gridToIsoTop(gx, gy, originX, originY, tileW, tileH);
        const fill = isBlocked(blockedSet, gx, gy) ? "#000" : (((gx + gy) % 2 === 0) ? "#f2f2f2" : "#fff");
        drawDiamond(ctx, sx, sy, tileW, tileH, fill);
      }
    }

    // --- highlights ---
    // previous tile
    drawHighlight(ctx, state, state.prev.x, state.prev.y, originX, originY, tileW, tileH, "rgba(0,180,255,0.18)");

    // queued target & step1
    if (state.queuedAction?.type === "move") {
      const { steps } = computeMoveSteps(state.ship.x, state.ship.y, state.ship.dir, state.queuedAction.move);

      if (steps.length === 2) {
        const s1 = steps[0];
        let tint1 = "rgba(255,255,0,0.12)";
        if (!inBounds(state, s1.x, s1.y)) tint1 = "rgba(255,165,0,0.18)";
        else if (isBlocked(blockedSet, s1.x, s1.y)) tint1 = "rgba(255,0,0,0.20)";
        drawHighlight(ctx, state, s1.x, s1.y, originX, originY, tileW, tileH, tint1);
      }

      if (steps.length >= 1) {
        const last = steps[steps.length - 1];
        let tint = "rgba(0,255,0,0.18)";
        if (!inBounds(state, last.x, last.y)) tint = "rgba(255,165,0,0.18)";
        else if (isBlocked(blockedSet, last.x, last.y)) tint = "rgba(255,0,0,0.20)";
        drawHighlight(ctx, state, last.x, last.y, originX, originY, tileW, tileH, tint);
      }
    }

    // --- projectiles (visual only) ---
    const stillAlive = [];
    for (const p of state.projectiles) {
      const t = clamp01((performance.now() - p.spawnTime) / p.durationMs);
      const from = tileCenter(p.fromX, p.fromY, originX, originY, tileW, tileH);
      const to = tileCenter(p.toX, p.toY, originX, originY, tileW, tileH);

      const x = lerp(from.x, to.x, t);
      const y = lerp(from.y, to.y, t) - Math.sin(t * Math.PI) * (tileH * 0.25);

      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(x, y, Math.max(3, tileH * 0.10), 0, Math.PI * 2);
      ctx.fill();

      if (t < 1) stillAlive.push(p);
    }
    // mutate only render-ephemera is okay (or you can do this in core if you prefer)
    state.projectiles = stillAlive;

    // --- ship ---
    const shipC = tileCenter(state.ship.x, state.ship.y, originX, originY, tileW, tileH);
    const r = Math.max(10, tileH * 0.30);

    const flash = (performance.now() - state.lastDamageAt) < 220;
    ctx.fillStyle = flash ? "#5a0c0c" : "#111";
    ctx.beginPath();
    ctx.arc(shipC.x, shipC.y, r, 0, Math.PI * 2);
    ctx.fill();

    // pointer triangle BLACK, iso-correct (uses projected forward tile direction)
    const f = getForwardScreenUnit(state, originX, originY, tileW, tileH);
    drawPointer(ctx, shipC.x, shipC.y, r, f.dx, f.dy);

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
    ctx.fillText(`queued: ${state.queuedAction ? (state.queuedAction.label ?? state.queuedAction.type) : "—"}`, 16, 114);

    ctx.font = "13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`controls: W/↑=Forward, A/←=F+Left, D/→=F+Right | space=shoot`, 16, 140);
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

  const Np = { x: topCorner.x, y: topCorner.y - off };
  const Ep = { x: rightCorner.x + off, y: rightCorner.y };
  const Sp = { x: bottomCorner.x, y: bottomCorner.y + off };
  const Wp = { x: leftCorner.x - off, y: leftCorner.y };

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
