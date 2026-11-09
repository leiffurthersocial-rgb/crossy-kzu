import { groundTexture } from './textures.js';

// The map cycles through biomes as you progress. Each biome has its own ground
// palette, scenery set and sky tint. Lane hazards are the same everywhere,
// so difficulty is driven by distance (config.difficulty) and not by biome.

export const BIOME_LENGTH = 40; // lanes per biome

export const BIOMES = [
  {
    id: 'meadow',
    name: 'Sunny Meadow',
    icon: '🌼',
    ground: ['#9ad86a', '#90cf61'],
    flowers: ['#ffffff', '#ff7aa8', '#ffd84a'],
    trees: ['tree', 'tree', 'tall'],
    leaves: ['#3a9d4a', '#43a852', '#349245'],
    rock: '#8d949b',
    dirt: '#8a6a45',
    sky: '#7cc6f0',
    sun: '#fff4e0',
  },
  {
    id: 'autumn',
    name: 'Autumn Woods',
    icon: '🍂',
    ground: ['#bcc865', '#b2bf5c'],
    flowers: ['#e2662a', '#f2b33a'],
    trees: ['tree', 'tall', 'tree'],
    leaves: ['#e2792a', '#d4502a', '#f0b13a', '#c9632a'],
    rock: '#948a80',
    dirt: '#7a5a3a',
    sky: '#f2c78f',
    sun: '#ffe0b0',
  },
  {
    id: 'snow',
    name: 'Frosty Peaks',
    icon: '❄️',
    ground: ['#eef4fa', '#e3ecf5'],
    flowers: [],
    trees: ['pine', 'pine', 'pine', 'tree'],
    leaves: ['#2f6b4f', '#36775a', '#2a5f47'],
    rock: '#9aa6b2',
    dirt: '#b3c2d2',
    sky: '#c3dcef',
    sun: '#eef5ff',
    snowy: true,
  },
  {
    id: 'desert',
    name: 'Sunset Dunes',
    icon: '🌵',
    ground: ['#efd391', '#e7ca85'],
    flowers: ['#e05a7a'],
    trees: ['cactus', 'cactus', 'palm'],
    leaves: ['#4f9a44', '#5aa64c'],
    rock: '#c4895a',
    dirt: '#c49a5c',
    sky: '#ffc98f',
    sun: '#ffd9a8',
  },
];

export function biomeIndex(row) {
  return Math.floor(Math.max(0, row) / BIOME_LENGTH) % BIOMES.length;
}

export function biomeAt(row) {
  return BIOMES[biomeIndex(row)];
}

const texCache = new Map();
/** Two ground textures per biome (alternating rows get the other one). */
export function biomeGroundTex(biome, odd) {
  const k = biome.id + (odd ? 'b' : 'a');
  let t = texCache.get(k);
  if (!t) {
    t = groundTexture(biome.ground[odd ? 1 : 0], biome.flowers, odd ? 21 : 42, !biome.snowy);
    texCache.set(k, t);
  }
  return t;
}
