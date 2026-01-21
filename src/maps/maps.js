export const MAPS = [
  {
    id: "islands",
    name: "Islands",
    grid: { rows: 7, cols: 7 },
    seed: 1337,
    spawn: { x: 3, y: 3, dir: 0, hp: 3, ammo: 15 },
    blocked: [
      { x: 1, y: 1, kind: "rock" },
      { x: 2, y: 1, kind: "rock" },
      { x: 5, y: 2, kind: "reef" },
      { x: 3, y: 4, kind: "wall" },
      { x: 4, y: 4, kind: "wall" },
    ],
    theme: {
      assets: {
        background: { image: "/assets/islands/background.txt" },
        tiles: {
          variants: [
            "/assets/islands/tiles/tile_1.txt",
            "/assets/islands/tiles/tile_2.txt",
            "/assets/islands/tiles/tile_3.txt",
            "/assets/islands/tiles/tile_4.txt",
          ],
        },
        blocked: {
          kinds: {
            rock: "/assets/islands/blocked/rock.txt",
            reef: "/assets/islands/blocked/reef.txt",
            wall: "/assets/islands/blocked/wall.txt",
            fallback: "/assets/islands/blocked/fallback.txt",
          },
        },
      },
    },
  },
  {
    id: "ice",
    name: "Ice",
    grid: { rows: 7, cols: 7 },
    seed: 2024,
    spawn: { x: 3, y: 3, dir: 0, hp: 3, ammo: 15 },
    blocked: [
      { x: 1, y: 1, kind: "rock" },
      { x: 2, y: 1, kind: "rock" },
      { x: 5, y: 2, kind: "reef" },
      { x: 3, y: 4, kind: "wall" },
      { x: 4, y: 4, kind: "wall" },
    ],
    theme: {
      assets: {
        background: { image: "/assets/ice/background.txt" },
        tiles: {
          variants: [
            "/assets/ice/tiles/tile_1.txt",
            "/assets/ice/tiles/tile_2.txt",
            "/assets/ice/tiles/tile_3.txt",
            "/assets/ice/tiles/tile_4.txt",
          ],
        },
        blocked: {
          kinds: {
            rock: "/assets/ice/blocked/rock.txt",
            reef: "/assets/ice/blocked/reef.txt",
            wall: "/assets/ice/blocked/wall.txt",
            fallback: "/assets/ice/blocked/fallback.txt",
          },
        },
      },
    },
  },
  {
    id: "desert",
    name: "Desert",
    grid: { rows: 7, cols: 7 },
    seed: 909,
    spawn: { x: 3, y: 3, dir: 0, hp: 3, ammo: 15 },
    blocked: [
      { x: 1, y: 1, kind: "rock" },
      { x: 2, y: 1, kind: "rock" },
      { x: 5, y: 2, kind: "reef" },
      { x: 3, y: 4, kind: "wall" },
      { x: 4, y: 4, kind: "wall" },
    ],
    theme: {
      assets: {
        background: { image: "/assets/desert/background.txt" },
        tiles: {
          variants: [
            "/assets/desert/tiles/tile_1.txt",
            "/assets/desert/tiles/tile_2.txt",
            "/assets/desert/tiles/tile_3.txt",
            "/assets/desert/tiles/tile_4.txt",
          ],
        },
        blocked: {
          kinds: {
            rock: "/assets/desert/blocked/rock.txt",
            reef: "/assets/desert/blocked/reef.txt",
            wall: "/assets/desert/blocked/wall.txt",
            fallback: "/assets/desert/blocked/fallback.txt",
          },
        },
      },
    },
  },
];

export function getMapById(id) {
  return MAPS.find((map) => map.id === id) ?? MAPS[0];
}
