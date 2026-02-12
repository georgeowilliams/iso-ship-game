import { GRAND_WORLD_MAP } from "./grand-world.js";

export const DEFAULT_MAP_ID = "grand-world";
export const MAPS = [GRAND_WORLD_MAP];

export function getAllMaps() {
  return MAPS;
}

export function getMapById(id) {
  return id === DEFAULT_MAP_ID ? GRAND_WORLD_MAP : null;
}

export function getDefaultMap() {
  return GRAND_WORLD_MAP;
}
