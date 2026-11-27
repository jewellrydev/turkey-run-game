// Turkey Run — The Great Escape.
// A 2D canvas side-scrolling runner: you are the turkey. Outrun the farmer,
// jump the ovens, duck the swinging carving knives, grab golden corn.
// Reach 1000 m and you are free. Three hits and you are dinner.
"use strict";

// ---------- setup ----------
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;
const GROUND_Y = 452;
const ESCAPE_DISTANCE = 1000;
const PX_PER_METRE = 46;

const params = new URLSearchParams(location.search);
const SHOT = params.get("shot");

// ---------- seeded random (for reproducible screenshots) ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rng = mulberry32(parseInt(params.get("seed") || "20261127", 10));
function rand(min, max) { return min + rng() * (max - min); }

// ---------- game state ----------
let state = "title";           // "title" | "play" | "end"
let endResult = "caught";      // "caught" | "escaped"
let score = 0;
let distanceM = 0;
let lives = 3;
let speed = 330;               // px per second
let scroll = 0;                // world scroll in px, drives parallax
let elapsed = 0;
let invulnerableUntil = 0;
let flashUntil = 0;
let frozen = false;            // screenshot mode: draw one scene, never update

const turkey = {
  x: 330,
  y: GROUND_Y,
  vy: 0,
  ducking: false,
  runPhase: 0,
  get height() { return this.ducking && this.onGround() ? 46 : 86; },
  onGround() { return this.y >= GROUND_Y; },
};

let farmerGap = 250;           // px between farmer and turkey
const farmer = { runPhase: 0 };

let obstacles = [];            // {kind:"oven"|"knife", x, swing}
let corns = [];                // {x, y, taken}
let spawnTimer = 1.1;
let cornTimer = 2.4;

// ---------- input ----------
const startButton = { x: W / 2 - 110, y: 356, w: 220, h: 56 };
const restartButton = { x: W / 2 - 110, y: 392, w: 220, h: 56 };

function pressJump() {
  if (state === "title") return startRun();
  if (state === "end") return startRun();
  if (turkey.onGround() && !turkey.ducking) {
    turkey.vy = -980;
    TurkeyAudio.jump();
  }
}
function pressDuckStart() {
  if (state === "play" && turkey.onGround() && !turkey.ducking) {
    turkey.ducking = true;
    TurkeyAudio.duck();
  }
}
function pressDuckEnd() { turkey.ducking = false; }

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
    e.preventDefault(); pressJump();
  } else if (e.code === "ArrowDown" || e.code === "KeyS") {
    e.preventDefault(); pressDuckStart();
  } else if (e.code === "Enter") {
    if (state !== "play") startRun();
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowDown" || e.code === "KeyS") pressDuckEnd();
});
canvas.addEventListener("mousedown", (e) => {
  TurkeyAudio.unlock();
  const r = canvas.getBoundingClientRect();
  const mx = (e.clientX - r.left) * (W / r.width);
  const my = (e.clientY - r.top) * (H / r.height);
  if (state === "title" && inside(mx, my, startButton)) return startRun();
  if (state === "end" && inside(mx, my, restartButton)) return startRun();
  pressJump();
});
function inside(x, y, b) { return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }

// ---------- run control ----------
function startRun() {
  TurkeyAudio.unlock();
  TurkeyAudio.start();
  state = "play";
  endResult = "caught";
  score = 0;
  distanceM = 0;
  lives = 3;
  speed = 330;
  scroll = 0;
  elapsed = 0;
  farmerGap = 250;
  turkey.y = GROUND_Y;
  turkey.vy = 0;
  turkey.ducking = false;
  obstacles = [];
  corns = [];
  spawnTimer = 1.15;
  cornTimer = 2.2;
  invulnerableUntil = 0;
}
function finishRun(result) {
  state = "end";
  endResult = result;
  if (result === "escaped") TurkeyAudio.win(); else TurkeyAudio.lose();
}
function hitObstacle(now) {
  if (now < invulnerableUntil) return;
  lives -= 1;
  farmerGap = Math.max(64, farmerGap - 105);
  invulnerableUntil = now + 1.1;
  flashUntil = now + 0.25;
  TurkeyAudio.hit();
  if (lives <= 0) finishRun("caught");
}

// ---------- spawning ----------
function spawnObstacle() {
  const kind = rng() < 0.55 ? "oven" : "knife";
  obstacles.push({ kind, x: W + rand(40, 220), swing: rand(0, Math.PI * 2) });
}
function spawnCorn() {
  const high = rng() < 0.45;
  corns.push({ x: W + rand(20, 160), y: high ? GROUND_Y - 128 : GROUND_Y - 34, taken: false });
}

// ---------- update ----------
function update(dt, now) {
  elapsed += dt;
  speed = Math.min(660, 330 + distanceM * 0.34);
  scroll += speed * dt;
  distanceM += (speed * dt) / PX_PER_METRE;
  score += (speed * dt) / PX_PER_METRE;

  farmerGap = Math.min(250, farmerGap + 9 * dt);
  farmer.runPhase += dt * 11;
  turkey.runPhase += dt * (turkey.onGround() ? 13 : 3);

  // turkey vertical physics
  if (!turkey.onGround() || turkey.vy < 0) {
    turkey.vy += 2500 * dt;
    turkey.y += turkey.vy * dt;
    if (turkey.y >= GROUND_Y) { turkey.y = GROUND_Y; turkey.vy = 0; }
  }

  // spawns
  spawnTimer -= dt;
  if (spawnTimer <= 0) { spawnObstacle(); spawnTimer = rand(0.95, 1.6) * (330 / speed) + 0.35; }
  cornTimer -= dt;
  if (cornTimer <= 0) { spawnCorn(); cornTimer = rand(1.6, 3.4); }

  // obstacles move + collide
  for (const ob of obstacles) {
    ob.x -= speed * dt;
    ob.swing += dt * 3.2;
    if (collides(ob, now)) hitObstacle(now);
  }
  obstacles = obstacles.filter((ob) => ob.x > -120);

  // corn move + collect
  for (const c of corns) {
    c.x -= speed * dt;
    if (!c.taken && Math.abs(c.x - turkey.x) < 46 && Math.abs(c.y - (turkey.y - 40)) < 58) {
      c.taken = true;
      score += 25;
      TurkeyAudio.corn();
    }
  }
  corns = corns.filter((c) => !c.taken && c.x > -40);

  if (farmerGap <= 66 && lives <= 1) finishRun("caught");
  if (distanceM >= ESCAPE_DISTANCE) finishRun("escaped");
}

function collides(ob, now) {
  if (now < invulnerableUntil) return false;
  const tLeft = turkey.x - 30, tRight = turkey.x + 34;
  const tTop = turkey.y - turkey.height, tBottom = turkey.y;
  if (ob.kind === "oven") {
    const oLeft = ob.x - 30, oRight = ob.x + 30, oTop = GROUND_Y - 66;
    return tRight > oLeft && tLeft < oRight && tBottom > oTop;
  }
  // knife: blade swings over the track at head height; ducking slips under.
  const kLeft = ob.x - 42, kRight = ob.x + 42;
  const kTop = GROUND_Y - 122, kBottom = GROUND_Y - 82;
  return tRight > kLeft && tLeft < kRight && tTop < kBottom && tBottom > kTop;
}

// ---------- drawing ----------
function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, "#8ec9e8");
  sky.addColorStop(0.7, "#f7d774");
  sky.addColorStop(1, "#f9b95c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND_Y);

  // sun
  ctx.fillStyle = "#fff3b0";
  ctx.beginPath(); ctx.arc(842, 76, 34, 0, Math.PI * 2); ctx.fill();

  // clouds (slow parallax)
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 263 - scroll * 0.12) % (W + 220) + W + 220) % (W + 220) - 110;
    cloud(cx, 52 + (i % 3) * 34);
  }

  // distant hills
  ctx.fillStyle = "#d9903f";
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  for (let x = 0; x <= W; x += 16) {
    const off = (x + scroll * 0.3) * 0.012;
    ctx.lineTo(x, GROUND_Y - 64 - Math.sin(off) * 22 - Math.sin(off * 0.37) * 12);
  }
  ctx.lineTo(W, GROUND_Y); ctx.closePath(); ctx.fill();

  // barn silhouette on the horizon
  ctx.fillStyle = "#b3402e";
  const barnX = ((700 - scroll * 0.3) % (W + 420) + W + 420) % (W + 420) - 210;
  ctx.fillRect(barnX, GROUND_Y - 118, 92, 62);
  ctx.beginPath();
  ctx.moveTo(barnX - 8, GROUND_Y - 118); ctx.lineTo(barnX + 46, GROUND_Y - 152); ctx.lineTo(barnX + 100, GROUND_Y - 118);
  ctx.closePath(); ctx.fill();

  // ground
  ctx.fillStyle = "#a5672a";
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.fillStyle = "#8a5220";
  for (let x = -((scroll) % 64); x < W; x += 64) ctx.fillRect(x, GROUND_Y + 26, 34, 7);

  // fence posts rushing past
  ctx.fillStyle = "#7c4a1e";
  for (let x = -((scroll * 1.0) % 150); x < W; x += 150) {
    ctx.fillRect(x, GROUND_Y - 40, 9, 40);
    ctx.fillRect(x - 4, GROUND_Y - 34, 60, 6);
  }

  // pumpkins on the ground line
  for (let x = -((scroll * 1.0) % 390); x < W; x += 390) pumpkin(x + 70, GROUND_Y + 4);
}
function cloud(x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.arc(x + 22, y + 4, 15, 0, Math.PI * 2);
  ctx.arc(x - 22, y + 5, 14, 0, Math.PI * 2);
  ctx.fill();
}
function pumpkin(x, y) {
  ctx.fillStyle = "#e07b24";
  ctx.beginPath(); ctx.ellipse(x, y - 8, 15, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#5d7a2a";
  ctx.fillRect(x - 2, y - 20, 4, 5);
}

function drawTurkey() {
  const { x, y } = turkey;
  const duck = turkey.ducking && turkey.onGround();
  const blink = performance.now() / 1000 < invulnerableUntil && Math.floor(performance.now() / 90) % 2 === 0;
  ctx.save();
  ctx.translate(x, y);
  if (blink) ctx.globalAlpha = 0.35;

  const legSwing = turkey.onGround() ? Math.sin(turkey.runPhase) * 9 : 6;
  ctx.strokeStyle = "#e8a13a";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-4, -18); ctx.lineTo(-4 + legSwing, 0);
  ctx.moveTo(10, -18); ctx.lineTo(10 - legSwing, 0);
  ctx.stroke();

  // tail feathers
  const tailColors = ["#c1442e", "#e07b24", "#e9c33c", "#7a9a3d"];
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = tailColors[i];
    ctx.save();
    ctx.translate(-26, duck ? -26 : -44);
    ctx.rotate(-0.7 + i * 0.32);
    ctx.beginPath(); ctx.ellipse(-13, 0, 17, 6.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // body
  ctx.fillStyle = "#8a5a33";
  ctx.beginPath();
  ctx.ellipse(0, duck ? -24 : -42, 34, duck ? 17 : 25, 0, 0, Math.PI * 2);
  ctx.fill();
  // wing
  ctx.fillStyle = "#6f4525";
  ctx.beginPath();
  ctx.ellipse(-2, duck ? -26 : -44, 17, duck ? 8 : 12, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // neck + head
  const headX = duck ? 34 : 28, headY = duck ? -34 : -70;
  ctx.strokeStyle = "#8a5a33";
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(16, duck ? -28 : -52); ctx.lineTo(headX, headY + 6); ctx.stroke();
  ctx.fillStyle = "#a06a3a";
  ctx.beginPath(); ctx.arc(headX, headY, 13, 0, Math.PI * 2); ctx.fill();
  // beak
  ctx.fillStyle = "#f2b035";
  ctx.beginPath();
  ctx.moveTo(headX + 11, headY - 2); ctx.lineTo(headX + 24, headY + 2); ctx.lineTo(headX + 11, headY + 6);
  ctx.closePath(); ctx.fill();
  // wattle
  ctx.fillStyle = "#d43a2a";
  ctx.beginPath(); ctx.ellipse(headX + 8, headY + 10, 4.5, 7, 0.2, 0, Math.PI * 2); ctx.fill();
  // eye
  ctx.fillStyle = "#1d130a";
  ctx.beginPath(); ctx.arc(headX + 5, headY - 3, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawFarmer() {
  const x = turkey.x - farmerGap;
  const y = GROUND_Y;
  const swing = Math.sin(farmer.runPhase) * 10;
  ctx.save();
  ctx.translate(x, y);
  // legs
  ctx.strokeStyle = "#31456e";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, -44); ctx.lineTo(swing, 0);
  ctx.moveTo(0, -44); ctx.lineTo(-swing, 0);
  ctx.stroke();
  // boots
  ctx.fillStyle = "#4a2f18";
  ctx.fillRect(swing - 5, -5, 13, 5);
  ctx.fillRect(-swing - 8, -5, 13, 5);
  // overalls + shirt
  ctx.fillStyle = "#3c5a8a";
  ctx.fillRect(-13, -78, 27, 36);
  ctx.fillStyle = "#c33b2a";
  ctx.fillRect(-15, -96, 31, 20);
  // reaching arm
  ctx.strokeStyle = "#e8b98a";
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(12, -90); ctx.lineTo(30, -74 + Math.sin(farmer.runPhase) * 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-12, -90); ctx.lineTo(-24, -72 - Math.sin(farmer.runPhase) * 5); ctx.stroke();
  // head + straw hat
  ctx.fillStyle = "#e8b98a";
  ctx.beginPath(); ctx.arc(0, -106, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#e9c33c";
  ctx.fillRect(-19, -116, 38, 6);
  ctx.fillRect(-10, -126, 20, 10);
  // angry eye
  ctx.fillStyle = "#1d130a";
  ctx.fillRect(5, -108, 4, 3);
  ctx.restore();

  // speech bubble when close
  if (farmerGap < 150 && state === "play") {
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath(); ctx.roundRect(x - 52, GROUND_Y - 176, 118, 30, 8); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 6, GROUND_Y - 146); ctx.lineTo(x + 6, GROUND_Y - 146); ctx.lineTo(x, GROUND_Y - 134);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#7a2415";
    ctx.font = "bold 13px Georgia";
    ctx.fillText("Come back, dinner!", x - 44, GROUND_Y - 156);
  }
}

function drawOven(ob) {
  const x = ob.x, top = GROUND_Y - 66;
  ctx.save();
  ctx.translate(x, 0);
  ctx.fillStyle = "#5a5f6b";
  ctx.fillRect(-30, top, 60, 66);
  ctx.fillStyle = "#3c4048";
  ctx.fillRect(-24, top + 16, 48, 34);
  // fire glow inside
  const flicker = 0.75 + Math.sin(performance.now() / 90 + ob.x) * 0.25;
  ctx.fillStyle = "rgba(255," + Math.floor(120 * flicker + 60) + ",30,0.95)";
  ctx.beginPath(); ctx.ellipse(0, top + 40, 13, 8 + flicker * 3, 0, 0, Math.PI * 2); ctx.fill();
  // burners + knobs
  ctx.fillStyle = "#2c2f36";
  ctx.beginPath(); ctx.arc(-14, top + 7, 5, 0, Math.PI * 2); ctx.arc(14, top + 7, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#cfd4dd";
  ctx.fillRect(-22, top + 55, 7, 7); ctx.fillRect(15, top + 55, 7, 7);
  // steam
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath(); ctx.arc(-8, top - 8 - flicker * 4, 6, 0, Math.PI * 2); ctx.arc(9, top - 13 - flicker * 5, 8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawKnife(ob) {
  const x = ob.x;
  const pivotY = GROUND_Y - 190;
  const angle = Math.sin(ob.swing) * 0.5;
  ctx.save();
  ctx.translate(x, pivotY);
  // hanging cord
  ctx.strokeStyle = "#6b4a26";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -70); ctx.lineTo(0, 0); ctx.stroke();
  ctx.rotate(angle);
  // handle
  ctx.fillStyle = "#7a3b1e";
  ctx.fillRect(-5, -4, 10, 26);
  // blade pointing down, edge to the right
  ctx.fillStyle = "#d7dde6";
  ctx.beginPath();
  ctx.moveTo(-5, 22);
  ctx.lineTo(26, 30);
  ctx.lineTo(30, 66);
  ctx.quadraticCurveTo(8, 78, -5, 62);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.beginPath();
  ctx.moveTo(2, 30); ctx.lineTo(22, 36); ctx.lineTo(24, 58); ctx.lineTo(4, 52);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  // warning label
  ctx.fillStyle = "#7a2415";
  ctx.font = "bold 12px Georgia";
  ctx.textAlign = "center";
  ctx.fillText("DUCK!", x, pivotY - 80);
  ctx.textAlign = "left";
}

function drawCorn(c) {
  ctx.save();
  ctx.translate(c.x, c.y + Math.sin(performance.now() / 300 + c.x) * 3);
  ctx.rotate(0.5);
  ctx.fillStyle = "#f6c945";
  ctx.beginPath(); ctx.ellipse(0, 0, 8, 16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#d99b1f";
  ctx.lineWidth = 1.4;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(i * 3.4, -13); ctx.lineTo(i * 3.4, 13); ctx.stroke();
  }
  ctx.fillStyle = "#7a9a3d";
  ctx.beginPath(); ctx.ellipse(-7, 12, 6, 10, 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawHeart(x, y, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = filled ? "#d43a2a" : "rgba(60,30,20,0.45)";
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.bezierCurveTo(-14, -4, -7, -14, 0, -6);
  ctx.bezierCurveTo(7, -14, 14, -4, 0, 8);
  ctx.fill();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = "rgba(43,26,16,0.72)";
  ctx.beginPath(); ctx.roundRect(14, 12, W - 28, 52, 10); ctx.fill();
  ctx.fillStyle = "#ffe9c9";
  ctx.font = "bold 21px Georgia";
  ctx.fillText("Score " + Math.floor(score), 30, 46);
  ctx.fillText("Distance " + Math.floor(distanceM) + " m / " + ESCAPE_DISTANCE + " m", 300, 46);
  ctx.fillText("Lives", 742, 46);
  for (let i = 0; i < 3; i++) drawHeart(828 + i * 38, 40, i < lives);
  // progress bar to freedom
  ctx.fillStyle = "rgba(255,233,201,0.3)";
  ctx.fillRect(30, 76, W - 60, 8);
  ctx.fillStyle = "#7ac74f";
  ctx.fillRect(30, 76, (W - 60) * Math.min(1, distanceM / ESCAPE_DISTANCE), 8);
}

function drawButton(b, label) {
  ctx.fillStyle = "#c1442e";
  ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 12); ctx.fill();
  ctx.strokeStyle = "#7a2415";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 12); ctx.stroke();
  ctx.fillStyle = "#fff6e3";
  ctx.font = "bold 26px Georgia";
  ctx.textAlign = "center";
  ctx.fillText(label, b.x + b.w / 2, b.y + 37);
  ctx.textAlign = "left";
}

function drawTitle() {
  drawBackground();
  turkey.y = GROUND_Y;
  farmerGap = 210;
  drawFarmer();
  drawTurkey();
  ctx.fillStyle = "rgba(43,26,16,0.55)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd98a";
  ctx.font = "bold 64px Georgia";
  ctx.fillText("TURKEY RUN", W / 2, 128);
  ctx.fillStyle = "#fff6e3";
  ctx.font = "italic 24px Georgia";
  ctx.fillText("The Great Escape", W / 2, 168);
  ctx.font = "20px Georgia";
  ctx.fillText("Thanksgiving is coming — and you are the main course.", W / 2, 224);
  ctx.fillText("Outrun the farmer, leap the ovens, duck the carving knives,", W / 2, 252);
  ctx.fillText("grab golden corn and reach 1000 m to be free!", W / 2, 280);
  ctx.font = "bold 19px Georgia";
  ctx.fillText("SPACE / CLICK — jump      ↓ / S — duck      3 hits and you're dinner", W / 2, 322);
  ctx.textAlign = "left";
  drawButton(startButton, "START RUN");
}

function drawEnd() {
  drawBackground();
  drawFarmer();
  drawTurkey();
  ctx.fillStyle = "rgba(43,26,16,0.62)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  if (endResult === "escaped") {
    ctx.fillStyle = "#9fe870";
    ctx.font = "bold 62px Georgia";
    ctx.fillText("ESCAPED!", W / 2, 150);
    ctx.fillStyle = "#fff6e3";
    ctx.font = "22px Georgia";
    ctx.fillText("You outran the farmer and dodged every oven and knife.", W / 2, 200);
    ctx.fillText("No turkey dinner this Thanksgiving — you are free!", W / 2, 232);
  } else {
    ctx.fillStyle = "#ff9a7a";
    ctx.font = "bold 62px Georgia";
    ctx.fillText("CAUGHT!", W / 2, 150);
    ctx.fillStyle = "#fff6e3";
    ctx.font = "22px Georgia";
    ctx.fillText("The farmer got his dinner after all...", W / 2, 200);
    ctx.fillText("Three hits was all it took. Run smarter next time!", W / 2, 232);
  }
  ctx.font = "bold 27px Georgia";
  ctx.fillStyle = "#ffd98a";
  ctx.fillText("Final score " + Math.floor(score), W / 2, 300);
  ctx.fillText("Distance " + Math.floor(distanceM) + " m of " + ESCAPE_DISTANCE + " m", W / 2, 340);
  ctx.textAlign = "left";
  drawButton(restartButton, "RUN AGAIN");
}

function drawPlay() {
  drawBackground();
  for (const c of corns) drawCorn(c);
  for (const ob of obstacles) {
    if (ob.kind === "oven") drawOven(ob); else drawKnife(ob);
  }
  drawFarmer();
  drawTurkey();
  drawHUD();
  if (performance.now() / 1000 < flashUntil) {
    ctx.fillStyle = "rgba(212,58,42,0.28)";
    ctx.fillRect(0, 0, W, H);
  }
}

// ---------- screenshot scenes ----------
function setupShotScene() {
  frozen = true;
  if (SHOT === "start") {
    state = "title";
    scroll = 120;
  } else if (SHOT === "play") {
    state = "play";
    scroll = 2600;
    distanceM = 386;
    score = 1240;
    lives = 2;
    farmerGap = 128;
    farmer.runPhase = 2.2;
    turkey.y = GROUND_Y - 96;         // mid-jump
    turkey.vy = -260;
    turkey.runPhase = 1.4;
    obstacles = [
      { kind: "oven", x: 618, swing: 0 },
      { kind: "knife", x: 838, swing: 0.9 },
    ];
    corns = [
      { x: 452, y: GROUND_Y - 128, taken: false },
      { x: 520, y: GROUND_Y - 34, taken: false },
    ];
  } else if (SHOT === "end") {
    state = "end";
    endResult = "escaped";
    scroll = 5200;
    distanceM = ESCAPE_DISTANCE;
    score = 2875;
    lives = 1;
    farmerGap = 235;
  }
}

// ---------- main loop ----------
let lastTime = performance.now();
function frame(nowMs) {
  const dt = Math.min(0.033, (nowMs - lastTime) / 1000);
  lastTime = nowMs;
  if (!frozen && state === "play") update(dt, nowMs / 1000);
  if (state === "title") drawTitle();
  else if (state === "end") drawEnd();
  else drawPlay();
  if (!frozen) requestAnimationFrame(frame);
}

if (SHOT) setupShotScene();
requestAnimationFrame(frame);
