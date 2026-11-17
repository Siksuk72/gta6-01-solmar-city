# Solmar City

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Siksuk72/gta6-01-solmar-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Siksuk72/gta6-01-solmar-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game for make.fun bounty **gta6-01**.
Explore the neon streets of Solmar City on foot or by car, outrun the police,
and work your way through six missions to take over the town.

## Play

```sh
node serve.ts        # then open http://localhost:8080
```

No build step, no network requests — 3D with the vendored three.js +
synthesized WebAudio. Everything (art, sound, music) is generated in code.

## The game

- **City:** an open world to explore on foot and by car, with traffic and
  pedestrians going about their day.
- **Wanted level + police:** cause trouble and the heat rises — police cars
  and officers chase you down; lose them to cool off.
- **Missions (6):** a story arc of jobs across the city, from a first getaway
  to the final takeover.
- **Combat:** fists and firearms, on foot and from behind the wheel.
- **HUD + minimap:** health, cash, wanted stars, mission tracker and a live
  minimap of the city.
- **Save:** progress is saved locally, so you can pick up where you left off.
- **Audio:** engine hums, sirens, gunshots and music — all synthesized with
  WebAudio, no audio files.

## Files

```
game/
  index.html            page shell
  src/
    config.js           constants: city, vehicles, police, palette
    random.js           seeded RNG (mulberry32)
    input.js            keyboard/gamepad, hit-testing
    audio.js            WebAudio SFX + ambient music (all synthesized)
    city.js             streets, buildings, props
    vehicles.js         cars, traffic, driving physics
    pedestrians.js      pedestrians, wandering and fleeing
    player.js           on-foot movement and combat
    police.js           wanted level, pursuit, roadblocks
    missions.js         the 6-mission story arc
    combat.js           weapons, damage, hit feedback
    camera.js           follow camera
    hud.js              HUD, minimap, screens
    save.js             localStorage save/load
    effects.js          particles, screen shake, skid marks
    world.js            game state, spawning, day flow
    shots.js            deterministic ?shot= scenes for screenshots
    main.js             fixed 60 Hz loop, screen state machine
main.ts                 copies game/ + screenshots/ to /output, writes dossier.json
serve.ts                tiny static server on :8080
shots.json              the 4 screenshots (cover / chase / mission / city)
```

Deterministic screenshot modes: `?shot=cover|chase|mission|city&seed=1` — seeded RNG,
fixed simulated time, `window.__shotReady = true` once drawn.

## Build the submission

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see `LICENSE`. Original idea, art, sounds and names; no Rockstar or
GTA assets are used anywhere in this game.

---

<sub>Entered on [make.fun](https://make.fun/?ref=hz26ha21&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
