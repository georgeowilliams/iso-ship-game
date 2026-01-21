// Grid directions in grid-space (not screen-space)
export const DIR = {
  N: 0,
  E: 1,
  S: 2,
  W: 3,
};

export const DIR_V = [
  { x: 0,  y: -1 }, // N
  { x: 1,  y:  0 }, // E
  { x: 0,  y:  1 }, // S
  { x: -1, y:  0 }, // W
];

export function leftOf(dir)  { return (dir + 3) % 4; }
export function rightOf(dir) { return (dir + 1) % 4; }