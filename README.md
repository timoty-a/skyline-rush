# Skyline Rush

**Take the high road.** An original Three.js rooftop runner set in a soft, sunlit city. Jump between buildings, dodge air vents, collect sun shards, and beat your personal best.

**[Play the game](https://timoty-a.github.io/skyline-rush/)**

## Features

- Procedurally generated rooftops with three lanes, gaps, and obstacles
- Animated low-poly runner, dynamic shadows, atmosphere, and collectible particles
- Increasing speed with fair jump physics, coyote time, and jump buffering
- Keyboard, swipe, and mobile button controls
- Four runner colours, optional synthesized sound effects, and saved personal best
- Pause/resume, automatic pause when the tab loses focus, and instant restart
- Static build with bundled Three.js; no API keys or external 3D assets needed

## Run locally

Requires Node.js **20.19+ or 22.12+**.

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:5174`.

```bash
npm test       # Collision, scoring, gap clearance, and storage checks
npm run build # Production files in dist/
npm run preview
```

## Controls

| Action | Keyboard | Mobile |
| --- | --- | --- |
| Change lane | ← / → or A / D | Swipe left/right or arrow buttons |
| Jump | Space / ↑ / W | Swipe up, tap the game, or JUMP |
| Pause/resume | P / Escape | Pause button, then Keep going |

Run as far as you can. Each metre is worth 2 points; each sun shard adds 50. Jump at the yellow rooftop edge. Clear air vents by jumping or changing lanes.

## start.ng integration status

The public game runs in **guest/demo mode**. It is not yet deployed on start.ng and does not independently authenticate users. The current team backend exposes accounts but no published game/appearance SDK. An adapter is included so the real platform can supply its authenticated user and central appearance without passing access tokens to the game.

See [INTEGRATION.md](INTEGRATION.md) for the proposed host contract and integration checklist. This contract must be agreed with the team; it is not an official start.ng SDK.

## Deployment

GitHub Actions runs tests, builds, and deploys `dist/` to GitHub Pages on pushes to `main`. Repository Settings → Pages must use **GitHub Actions** as its source. Vite uses relative asset paths so the game works under the repository URL or a platform subdirectory.

## Stack and assets

Three.js, Vite, JavaScript, HTML, and CSS. All 3D geometry, icons, textures, and sound effects are generated in code. DM Sans and Space Grotesk are loaded from Google Fonts, with system font fallbacks. High scores and guest colour choices stay in this browser's local storage; there is no global leaderboard or score server.
