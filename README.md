# Crossy KZU

An endless voxel lane-hopper for desktop and mobile browsers, built with Vite, vanilla JS and Three.js. Every model is made procedurally from `BoxGeometry` cubes. Every sound is generated with the Web Audio API. The game uses no image, model or audio files.

## Run

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173). `npm run build` writes a static build to `dist/`.

## Controls

| Action      | Desktop             | Mobile                |
|-------------|---------------------|-----------------------|
| Hop         | Arrow keys / WASD   | Swipe in a direction  |
| Hop forward | ↑ / W               | Tap anywhere          |
| Pause       | Esc / P             | Pause button          |
| Mute        | M                   | Speaker button        |
| Start/Retry | Enter / Space       | Buttons               |

Inputs are buffered (up to 3), so quick presses chain into consecutive hops.

## Rules

- **Grass** is safe. Trees and rocks block movement.
- **Roads** have cars and trucks. Getting hit ends the run.
- **Rivers** have logs and lily pads. Landing in the water ends the run. A log carries you with it, and riding it off the edge of the play area ends the run.
- **Railways** flash and ring a bell before a fast train comes through.
- The camera slowly moves forward. If you fall behind it, or make no forward progress for 9 seconds, an eagle grabs you.
- Your score is the furthest lane you reach. Coins are saved across runs and unlock characters.
- The map changes biome every 40 lanes: **Sunny Meadow → Autumn Woods → Frosty Peaks → Sunset Dunes**, then repeats. Each biome has its own ground, scenery (oak, pine, cactus, palm), rocks and lighting tint.
- The screen edges glow red shortly before the eagle comes, so you get a warning.

## Adding a character

Characters are pure data in [`src/characters.js`](src/characters.js). Append an entry to `CHARACTERS`:

```js
{
  id: 'sam',                 // unique, used for saves
  name: 'Sam',
  cost: 175,                 // coins to unlock (0 = free)
  build: 'normal',           // 'lean' | 'normal' | 'slightlyHeavy' | 'heavyMuscular'
  skin: SKIN.tan,            // or any hex colour
  eyes: EYES.blue,
  hair: { style: 'spiky', color: '#222222' }, // 'short' | 'spiky' | 'styled' | 'modcut' | 'middlePart' | 'buzz'
  shirt: '#ff8800',
  pants: '#333333',
  shoes: '#ffffff',
  accessories: ['glasses'],  // any of 'glasses', 'goatee'
},
```

The character select screen picks up new entries automatically. To add a new hair style or accessory, add a `case` in `addHair()` or a branch in `buildCharacter()` in [`src/characterFactory.js`](src/characterFactory.js). To add a new build, add its proportions to `BUILDS` in the same file.

## Code layout

| File | Responsibility |
|------|----------------|
| `src/main.js` | Game class: renderer, camera, state machine (title / select / playing / paused / dying / over), main loop, adaptive quality |
| `src/world.js` | Lane generator (seeded, weighted, with streak limits and passability checks), lane pooling and recycling, collision queries |
| `src/entities.js` | Voxel factories and object pools for cars, trucks, logs, lily pads, trains, trees, rocks, coins and signals |
| `src/player.js` | Grid movement, hop arc, input queue, log riding, collisions, death animations |
| `src/characterFactory.js` | Shared voxel humanoid rig (head, torso, arms, legs) built from character parameters |
| `src/characters.js` | Character roster data |
| `src/textures.js` | Pixel-art textures painted on canvases at startup (grass, asphalt, gravel, water, bark, leaves) |
| `src/biomes.js` | Biome table (palettes, scenery sets, sky/sun tint) and per-biome ground textures |
| `src/effects.js` | Particles (splash, dust, sparkle) and the eagle |
| `src/ui.js` | DOM screens and HUD |
| `src/audio.js` | Synthesised sound effects |
| `src/input.js` | Keyboard, swipe and tap input |
| `src/storage.js` | localStorage persistence (best score, coins, unlocks, selection, mute) |
| `src/config.js` | Tuning constants and the difficulty curve |

### Design notes

- **Passability:** consecutive grass lanes always share an open run of tiles reachable from the previous lane. Every grass lane keeps at least 3 open tiles. Vehicles keep a minimum gap that scales with speed. Logs keep a maximum gap, and adjacent river lanes flow in opposite directions.
- **Difficulty:** as the score grows, road and river lanes get more frequent, road runs get longer, vehicles and logs get faster, and the camera moves forward faster.
- **Textures:** all textures are generated in code on small canvases with nearest-neighbour filtering, so they stay crisp and blocky. Water scrolls with the current. Ground boxes use a two-group cube (top + sides), so a textured lane costs 2 draw calls, not 6.
- **Feedback:** score and coin pops, biome and new-best toasts, a hit-stop, screen flash and vibration on death, a first-run tutorial, and 48px+ touch targets.
- **Performance:** all meshes share one unit cube geometry and a cached material per colour. Lanes and moving entities are pooled and recycled once they fall behind the camera. Moving entities loop around the lane, so no objects are created during play. On slow devices the game lowers the pixel ratio first and then turns off shadows.
