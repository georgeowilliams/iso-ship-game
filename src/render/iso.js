export function gridToIsoTop(gx, gy, originX, originY, tileW, tileH) {
  const halfW = tileW / 2;
  const halfH = tileH / 2;
  return {
    sx: originX + (gx - gy) * halfW,
    sy: originY + (gx + gy) * halfH
  };
}

export function tileCenter(gx, gy, originX, originY, tileW, tileH) {
  const top = gridToIsoTop(gx, gy, originX, originY, tileW, tileH);
  return { x: top.sx, y: top.sy + tileH / 2 };
}

/**
 * Returns the four extreme corners of the drawn diamond-grid (screen-space).
 * These are used to place N/E/S/W labels just outside the grid.
 */
export function computeGridCorners(state, originX, originY, tileW, tileH) {
  const halfW = tileW / 2;
  const halfH = tileH / 2;

  const top = gridToIsoTop(0, 0, originX, originY, tileW, tileH);
  const tr = gridToIsoTop(state.cols - 1, 0, originX, originY, tileW, tileH);
  const br = gridToIsoTop(state.cols - 1, state.rows - 1, originX, originY, tileW, tileH);
  const bl = gridToIsoTop(0, state.rows - 1, originX, originY, tileW, tileH);

  const topCorner = { x: top.sx, y: top.sy };
  const rightCorner = { x: tr.sx + halfW, y: tr.sy + halfH };
  const bottomCorner = { x: br.sx, y: br.sy + tileH };
  const leftCorner = { x: bl.sx - halfW, y: bl.sy + halfH };

  return { topCorner, rightCorner, bottomCorner, leftCorner };
}

export function computeOrigin(state, canvasW, canvasH, tileW, tileH) {
  const isoW = (state.cols + state.rows) * (tileW / 2);
  const isoH = (state.cols + state.rows) * (tileH / 2) + tileH;

  const pad = Math.max(40, tileW);
  const originX = Math.floor((canvasW - isoW) / 2 + isoW / 2);
  const originY = Math.floor((canvasH - isoH) / 2) + pad * 0.35;

  return { originX, originY, pad };
}
