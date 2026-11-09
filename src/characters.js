// Data-driven character roster. To add a character, append an entry here.
//
// build:      'lean' | 'normal' | 'slightlyHeavy' | 'heavyMuscular'
// hair.style: 'short' | 'spiky' | 'styled' | 'modcut' | 'middlePart' | 'buzz'
// accessories: any of 'glasses', 'goatee'
// cost:       coins needed to unlock (0 = unlocked by default)

export const SKIN = {
  pale: '#f6dfcc',
  light: '#f1cba8',
  lightTan: '#e2b086',
  tan: '#d29a6a',
  olive: '#c09060',
  bronze: '#a8703f',
  deepBrown: '#6b4428',
};

export const EYES = {
  brown: '#5a3518',
  darkBrown: '#2e1a0c',
  gray: '#7c8791',
  blue: '#3a7bd5',
};

export const CHARACTERS = [
  {
    id: 'robin',
    name: 'Robin',
    cost: 0,
    build: 'normal',
    skin: SKIN.lightTan,
    eyes: EYES.brown,
    hair: { style: 'short', color: '#e8c55a' },
    shirt: '#3d8be0',
    pants: '#2b3a63',
    shoes: '#f2f2f2',
    accessories: [],
  },
  {
    id: 'leif',
    name: 'Leif',
    cost: 25,
    build: 'lean',
    skin: SKIN.tan,
    eyes: EYES.gray,
    hair: { style: 'spiky', color: '#6b4423' },
    shirt: '#1d1d21',
    pants: '#7d7f86',
    shoes: '#2a2a2a',
    accessories: [],
  },
  {
    id: 'erim',
    name: 'Erim',
    cost: 50,
    build: 'normal',
    skin: SKIN.olive,
    eyes: EYES.brown,
    hair: { style: 'short', color: '#141414' },
    shirt: '#6b8e3a',
    pants: '#cbb68a',
    shoes: '#4a3524',
    accessories: ['glasses', 'goatee'],
  },
  {
    id: 'lenni',
    name: 'Lenni',
    cost: 75,
    build: 'normal',
    skin: SKIN.light,
    eyes: EYES.brown,
    hair: { style: 'middlePart', color: '#7a4a26' },
    shirt: '#7d4fb0',
    pants: '#525d78',
    shoes: '#e9e9e9',
    accessories: ['glasses'],
  },
  {
    id: 'till',
    name: 'Till',
    cost: 100,
    build: 'lean',
    skin: SKIN.pale,
    eyes: EYES.blue,
    hair: { style: 'modcut', color: '#f0d77a' },
    shirt: '#e67e22',
    pants: '#3e5c82',
    shoes: '#262626',
    accessories: [],
  },
  {
    id: 'tusya',
    name: 'Tusya',
    cost: 125,
    build: 'slightlyHeavy',
    skin: SKIN.deepBrown,
    eyes: EYES.darkBrown,
    hair: { style: 'buzz', color: '#121212' },
    shirt: '#1fa39a',
    pants: '#3a3a42',
    shoes: '#f0f0f0',
    accessories: [],
  },
  {
    id: 'leonidas',
    name: 'Leonidas',
    cost: 150,
    build: 'heavyMuscular',
    skin: SKIN.bronze,
    eyes: EYES.brown,
    hair: { style: 'styled', color: '#3b2414' },
    shirt: '#b3262e',
    pants: '#4a3424',
    shoes: '#1a1a1a',
    accessories: [],
  },
];

export const BUILD_LABEL = {
  lean: 'Lean',
  normal: 'Normal',
  slightlyHeavy: 'Sturdy',
  heavyMuscular: 'Muscular',
};

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}
