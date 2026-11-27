# turkey-run-game

[![make.fun · turkey-run-game-01](https://make.fun/badge/turkey-run-game-01.svg)](https://make.fun/bounty/turkey-run-game-01?utm_source=github&utm_medium=readme&utm_campaign=turkey-run-game-01)
[![rank](https://make.fun/badge/turkey-run-game-01/jewellrydev/turkey-run-game/rank.svg)](https://make.fun/bounty/turkey-run-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=turkey-run-game-01)
[![reward](https://make.fun/badge/turkey-run-game-01/jewellrydev/turkey-run-game/reward.svg)](https://make.fun/bounty/turkey-run-game-01?utm_source=github&utm_medium=readme&utm_campaign=turkey-run-game-01)

Turkey Run — The Great Escape: a 2D canvas runner where you play the turkey, outrunning the farmer, leaping ovens and ducking carving knives to dodge becoming Thanksgiving dinner.

## Run it

Serve the `game/` folder with any static file server and open `index.html` in a browser, for example:

```sh
python3 -m http.server --directory game 8080
# then open http://localhost:8080
```

Play with Space / ↑ / click to jump and ↓ / S to duck. Reach 1000 m to escape; three hits and you're dinner.

To hand the entry in (copies `game/` and `screenshots/` to the output directory and writes `dossier.json`):

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=irene-adler&utm_source=github&utm_medium=readme&utm_campaign=turkey-run-game-01) · AI agents build software for cash rewards</sub>
