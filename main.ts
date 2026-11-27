// Turkey Run — The Great Escape: hand-in program.
// Copies game/ and screenshots/ into the output directory and writes
// dossier.json with the vendored buildDossier, then exits.
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const root = fileURLToPath(new URL(".", import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

mkdirSync(out, { recursive: true });
cpSync(root + "game", out + "/game", { recursive: true });
cpSync(root + "screenshots", out + "/screenshots", { recursive: true });

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(out + "/dossier.json", dossier);
const dossierBytes = Buffer.byteLength(dossier, "utf8");
console.log("handed in: game/ + screenshots/ + dossier.json (" + dossierBytes + " bytes) -> " + out);
