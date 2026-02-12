export const MAPS = [
  {
    id: "islands",
    name: "Islands",
    grid: { rows: 7, cols: 7 },
    seed: 1337,
    spawn: { x: 3, y: 3, dir: 0, hp: 6, ammo: 15 },
    enemySpawn: { x: 1, y: 5, dir: 2, hp: 6, ammo: 15 },
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
        ship: {
          N: "/assets/islands/ship/ship_N.txt",
          E: "/assets/islands/ship/ship_E.txt",
          S: "/assets/islands/ship/ship_S.txt",
          W: "/assets/islands/ship/ship_W.txt",
        },
      },
    },
    hazards: [
      { x: 1, y: 3, damage: 1, kind: "reef" },
      { x: 5, y: 3, damage: 2, kind: "reef" },
    ],
  },
  {
    id: "ice",
    name: "Ice",
    grid: { rows: 7, cols: 7 },
    seed: 2024,
    spawn: { x: 3, y: 3, dir: 0, hp: 6, ammo: 15 },
    enemySpawn: { x: 1, y: 5, dir: 2, hp: 6, ammo: 15 },
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
        ship: {
          N: "/assets/ice/ship/ship_N.txt",
          E: "/assets/ice/ship/ship_E.txt",
          S: "/assets/ice/ship/ship_S.txt",
          W: "/assets/ice/ship/ship_W.txt",
        },
      },
    },
    hazards: [
      { x: 2, y: 2, damage: 1, kind: "ice" },
      { x: 4, y: 5, damage: 2, kind: "ice" },
    ],
  },
  {
    id: "desert",
    name: "Desert",
    grid: { rows: 7, cols: 7 },
    seed: 909,
    spawn: { x: 3, y: 3, dir: 0, hp: 6, ammo: 15 },
    enemySpawn: { x: 1, y: 5, dir: 2, hp: 6, ammo: 15 },
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
        ship: {
          N: "/assets/desert/ship/ship_N.txt",
          E: "/assets/desert/ship/ship_E.txt",
          S: "/assets/desert/ship/ship_S.txt",
          W: "/assets/desert/ship/ship_W.txt",
        },
      },
    },
    hazards: [
      { x: 2, y: 4, damage: 1, kind: "sand" },
      { x: 4, y: 1, damage: 2, kind: "sand" },
    ],
  },
  {
    id: "grand-world",
    name: "Grand World",
    world: { minX: 0, minY: 0, maxX: 24, maxY: 24 },
    viewport: { rows: 13, cols: 13 },
    seed: 5150,
    spawn: { x: 12, y: 12, dir: 0, hp: 6, ammo: 15 },
    enemySpawn: { x: 4, y: 20, dir: 2, hp: 6, ammo: 15 },
    blocked: [
      { x: 8, y: 9, kind: "reef" },
      { x: 9, y: 9, kind: "reef" },
      { x: 15, y: 15, kind: "rock" },
      { x: 3, y: 18, kind: "wall" },
    ],
    blockedGroups: [
      {
        id: "northern-wall",
        kind: "wall",
        anchor: { x: 10, y: 7, anchorMode: "bottom" },
        footprint: { w: 4, h: 2 },
      },
      {
        id: "eastern-reef",
        kind: "reef",
        anchor: { x: 18, y: 14, anchorMode: "bottom" },
        footprint: { w: 3, h: 3 },
      },
    ],
    checkpoints: [
      { id: "cp-north", x: 12, y: 6, radius: 1, label: "North Beacon" },
      { id: "cp-center", x: 12, y: 12, radius: 1, label: "Center Dock" },
      { id: "cp-south", x: 12, y: 20, radius: 1, label: "South Haven" },
    ],
    hazards: [
      { x: 7, y: 12, damage: 1, kind: "reef" },
      { x: 20, y: 10, damage: 2, kind: "reef" },
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
        ship: {
          N: "/assets/desert/ship/ship_N.txt",
          E: "/assets/desert/ship/ship_E.txt",
          S: "/assets/desert/ship/ship_S.txt",
          W: "/assets/desert/ship/ship_W.txt",
        },
      },
    },
  },
];

export function getAllMaps() {
  return [...MAPS];
}

export function getMapById(id) {
  return MAPS.find((map) => map.id === id) ?? MAPS[0];
}
