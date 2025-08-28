// === Top-Down Shooter (JS only) ============================================
// Drop-in replacement for your existing script, keeping your assets (player
// directional frames u1..4/d1..4/l1..4/r1..4 and slime 12-frame images).
// Adds: (1) spatial hash for faster collisions, (2) player fire cooldown,
// (3) smoother enemy AI + simple enemy types (normal/fast/tank).

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- Canvas & Play Area ------------------------------------------------------
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const topBlackAreaHeight = 400;
const bottomBlackAreaHeight = 150;

let visibleWidth = canvas.width;
let visibleHeight = canvas.height - topBlackAreaHeight - bottomBlackAreaHeight;

// --- Utility -----------------------------------------------------------------
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function randRange(min, max) { return Math.random() * (max - min) + min; }
function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.hypot(dx, dy); }
function circleHit(ax, ay, ar, bx, by, br) { return dist(ax, ay, bx, by) < (ar + br); }

// --- Player ------------------------------------------------------------------
const player = {
  x: visibleWidth / 2,
  y: topBlackAreaHeight + visibleHeight / 2,
  size: 80,
  speed: 5,
  dx: 0,
  dy: 0,
  currentFrame: 0,
  frameSpeed: 120,
  lastFrameTime: 0,
  movementDirection: "down",
  isMoving: false,
  health: 5,
  maxHealth: 5,
  isInvincible: false,
  invincibilityDuration: 1000,
  lastHitTime: 0,
  // NEW: shooting cooldown
  lastShotTime: 0,
  fireCooldown: 250 // ms
};

let score = 0;
let gameOver = false;

// --- Input -------------------------------------------------------------------
const keys = {};
document.addEventListener("keydown", (e) => {
  keys[e.key] = true;

  if (!gameOver) {
    if (e.key === "i" || e.key === "I") tryShoot();
    if (e.key === "ArrowUp")  { player.dy = -player.speed; player.movementDirection = "up"; }
    if (e.key === "ArrowDown"){ player.dy =  player.speed; player.movementDirection = "down"; }
    if (e.key === "ArrowLeft"){ player.dx = -player.speed; player.movementDirection = "left"; }
    if (e.key === "ArrowRight"){player.dx =  player.speed; player.movementDirection = "right"; }
    player.isMoving = true;
  }

  if (gameOver && (e.key === "r" || e.key === "R")) restartGame();
});

document.addEventListener("keyup", (e) => {
  keys[e.key] = false;
  if (!keys["ArrowUp"] && !keys["ArrowDown"]) player.dy = 0;
  if (!keys["ArrowLeft"] && !keys["ArrowRight"]) player.dx = 0;
  player.isMoving = keys["ArrowUp"] || keys["ArrowDown"] || keys["ArrowLeft"] || keys["ArrowRight"];
});

// --- Sprites & Background ----------------------------------------------------
const playerImages = { up: [], down: [], left: [], right: [] };
const backgroundImage = new Image();
backgroundImage.src = "img/bg.jpg";
let bgLoaded = false;
backgroundImage.onload = () => { bgLoaded = true; };
const slimeImages = [];

function loadImg(src) {
  return new Promise((resolve) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = src; });
}
(async function loadPlayerImages() { for (let i = 1; i <= 4; i++) { playerImages.up.push(await loadImg(`img/u${i}.png`)); playerImages.down.push(await loadImg(`img/d${i}.png`)); playerImages.left.push(await loadImg(`img/l${i}.png`)); playerImages.right.push(await loadImg(`img/r${i}.png`)); } })();
(async function loadSlimeImages() { for (let i = 1; i <= 12; i++) { slimeImages.push(await loadImg(`img/slime/slm${i}.png`)); } })();

// --- Lasers ------------------------------------------------------------------
const laserSpeed = 8;
const laserSize = 10;
const playerLasers = [];


function tryShoot() {
  const now = performance.now();
  if (now - player.lastShotTime >= player.fireCooldown) {
    createPlayerLaser();
    player.lastShotTime = now;
  }
}
function createPlayerLaser() {
  let dx = 0, dy = 0;
  if (keys["ArrowUp"]) dy = -1;
  if (keys["ArrowDown"]) dy = 1;
  if (keys["ArrowLeft"]) dx = -1;
  if (keys["ArrowRight"]) dx = 1;
  if (dx === 0 && dy === 0) {
    if (player.movementDirection === "up") dy = -1;
    if (player.movementDirection === "down") dy = 1;
    if (player.movementDirection === "left") dx = -1;
    if (player.movementDirection === "right") dx = 1;
  }
  const len = Math.hypot(dx, dy) || 1;
  dx = (dx / len) * laserSpeed;
  dy = (dy / len) * laserSpeed;
  playerLasers.push({ x: player.x + player.size/2, y: player.y + player.size/2, dx, dy, size: laserSize });
}

function updateLasers() {
  for (let i = playerLasers.length - 1; i >= 0; i--) {
      const l = playerLasers[i];
      l.x += l.dx; l.y += l.dy;
      if (l.x < -50 || l.x > canvas.width + 50 || l.y < -50 || l.y > canvas.height + 50) {
         playerLasers.splice(i, 1);
      }
  }
}
function drawLasers() {
  ctx.fillStyle = "blue";
  for (const l of playerLasers) { 
    ctx.beginPath(); 
    ctx.arc(l.x, l.y, l.size, 0, Math.PI * 2); 
    ctx.fill(); }
}

// --- Enemies -----------------------------------------------------------------
const enemies = [];
let lastSpawnTime = 0;
let floatingTexts = [];

// Simple enemy types (no extra assets required)
const enemyTypes = [
  { key: "normal", speedMul: 1.0, hpBonus: 0 },
  { key: "fast",   speedMul: 1.5, hpBonus: -1 },
  { key: "tank",   speedMul: 0.7, hpBonus: +2 }
];

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  let x, y; const margin = 40;
  if (side === 0) { x = randRange(0, visibleWidth - 60); y = topBlackAreaHeight + margin; }
  else if (side === 1) { x = randRange(0, visibleWidth - 60); y = topBlackAreaHeight + visibleHeight - margin - 60; }
  else if (side === 2) { x = margin; y = randRange(topBlackAreaHeight + margin, topBlackAreaHeight + visibleHeight - margin - 60); }
  else { x = visibleWidth - margin - 60; y = randRange(topBlackAreaHeight + margin, topBlackAreaHeight + visibleHeight - margin - 60); }

  const variant = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];

  const baseSpeed = 1.8 + Math.min(2.2, score * 0.02);
  const enemy = {
    x, y,
    size: 60,
    speed: baseSpeed * variant.speedMul,
    dx: randRange(-1, 1), dy: randRange(-1, 1),
    maxHealth: Math.max(1, 2 + Math.floor(score / 15) + variant.hpBonus),
    health: Math.max(1, 2 + Math.floor(score / 15) + variant.hpBonus),
    fireInterval: randRange(800, 1600) - Math.min(600, score * 5),
    lastFire: performance.now() + randRange(0, 500),
    currentFrame: 0,
    lastFrameTime: 0,
    frameSpeed: 100,
    type: variant.key
  };
  const len = Math.hypot(enemy.dx, enemy.dy) || 1; enemy.dx = (enemy.dx / len) * enemy.speed; enemy.dy = (enemy.dy / len) * enemy.speed;
  enemies.push(enemy);
}

function updateEnemies() {
  const now = performance.now();
  const desired = Math.min(5 + Math.floor(score / 15), 20);
  if (enemies.length < desired && now - lastSpawnTime > 800) { spawnEnemy(); lastSpawnTime = now; }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    // Animate
    if (now - e.lastFrameTime > e.frameSpeed) { e.currentFrame = (e.currentFrame + 1) % 12; e.lastFrameTime = now; }

    // Smooth pursuit (no stutter by animation frame)
    const seekAngle = Math.atan2((player.y + player.size / 2) - (e.y + e.size / 2), (player.x + player.size / 2) - (e.x + e.size / 2));
    const seekDX = Math.cos(seekAngle) * e.speed;
    const seekDY = Math.sin(seekAngle) * e.speed;
    e.dx = e.dx * 0.9 + seekDX * 0.1;
    e.dy = e.dy * 0.9 + seekDY * 0.1;

    e.x += e.dx; e.y += e.dy;

    // Clamp & bounce lightly
    e.x = clamp(e.x, 0, visibleWidth - e.size);
    e.y = clamp(e.y, topBlackAreaHeight, topBlackAreaHeight + visibleHeight - e.size);
    if (e.x <= 0 || e.x >= visibleWidth - e.size) e.dx *= -0.6;
    if (e.y <= topBlackAreaHeight || e.y >= topBlackAreaHeight + visibleHeight - e.size) e.dy *= -0.6;

    // Touch damage + knockback
    if (circleHit(e.x + e.size / 2, e.y + e.size / 2, e.size / 2,
              player.x + player.size / 2, player.y + player.size / 2, player.size / 2)) {
       // 💥 Enemy-type damage
       let dmg = 1;
       if (e.type === "normal") dmg = Math.floor(Math.random() * 3) + 1; // 1–3
       if (e.type === "fast")   dmg = 1;                                // always 1
       if (e.type === "tank")   dmg = Math.floor(Math.random() * 3) + 3; // 3–5

       for (let d = 0; d < dmg; d++) damagePlayer();  

       // 🔄 Player knockback
       const ang = Math.atan2(player.y - e.y, player.x - e.x);
       player.x += Math.cos(ang) * 20;
       player.y += Math.sin(ang) * 20;
       player.x = clamp(player.x, 0, visibleWidth - player.size);
       player.y = clamp(player.y, topBlackAreaHeight, topBlackAreaHeight + visibleHeight - player.size);
    }
  }
}

function drawEnemies() {
  for (const e of enemies) {
    const img = slimeImages[e.currentFrame];
    if (img) ctx.drawImage(img, e.x, e.y, e.size, e.size);
    // Health bar
    const bw = e.size, bh = 8, bx = e.x, by = e.y - 12;
    ctx.fillStyle = "grey"; ctx.fillRect(bx, by, bw, bh);
    const pct = clamp(e.health / e.maxHealth, 0, 1);
    ctx.fillStyle = pct > 0.5 ? "limegreen" : pct > 0.25 ? "yellow" : "red";
    ctx.fillRect(bx, by, bw * pct, bh);
    ctx.strokeStyle = "black"; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, bh);
  }
}

// --- Spatial Hash Grid for Collisions ---------------------------------------
const CELL = 120; // adjust for performance vs. accuracy
let grid = new Map();
function cellKey(cx, cy){ return cx + "," + cy; }
function toCell(x, y){ return [Math.floor(x / CELL), Math.floor(y / CELL)]; }
function clearGrid(){ grid.clear(); }
function addEnemyToGrid(index){
  const e = enemies[index];
  const minCX = Math.floor(e.x / CELL);
  const maxCX = Math.floor((e.x + e.size) / CELL);
  const minCY = Math.floor(e.y / CELL);
  const maxCY = Math.floor((e.y + e.size) / CELL);
  for (let cy = minCY; cy <= maxCY; cy++) {
    for (let cx = minCX; cx <= maxCX; cx++) {
      const k = cellKey(cx, cy);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(index);
    }
  }
}
function buildGrid(){ clearGrid(); for (let i = 0; i < enemies.length; i++) addEnemyToGrid(i); }
function getCandidates(x, y, r){
  const minCX = Math.floor((x - r) / CELL), maxCX = Math.floor((x + r) / CELL);
  const minCY = Math.floor((y - r) / CELL), maxCY = Math.floor((y + r) / CELL);
  const set = new Set();
  for (let cy = minCY; cy <= maxCY; cy++) {
    for (let cx = minCX; cx <= maxCX; cx++) {
      const arr = grid.get(cellKey(cx, cy));
      if (arr) for (const idx of arr) set.add(idx);
    }
  }
  return set;
}

// --- Collisions --------------------------------------------------------------
function handleCollisions() {
  // Build grid once per frame for enemies
  buildGrid();

  // Player lasers vs enemies (use spatial hash)
  for (let i = playerLasers.length - 1; i >= 0; i--) {
    const l = playerLasers[i];
    const candidates = getCandidates(l.x, l.y, l.size / 2);
    let hit = false;
    for (const idx of candidates) {
      const e = enemies[idx]; if (!e) continue;
      const ex = e.x + e.size / 2, ey = e.y + e.size / 2, er = e.size / 2;
      if (circleHit(l.x, l.y, l.size / 2, ex, ey, er)) {
        e.health -= 1; hit = true;
        if (e.health <= 0) { enemies.splice(idx, 1); score += 1; }
      }
    }
    if (hit) playerLasers.splice(i, 1);
  }
}

function damagePlayer() {
  if (!player.isInvincible) {
    player.health--; player.isInvincible = true; player.lastHitTime = performance.now();
    if (player.health <= 0) { gameOver = true; }
  }
}

// --- Player Update/Draw ------------------------------------------------------
function updatePlayer() {
  // Hold-to-shoot support with cooldown
  if (keys["i"] || keys["I"]) tryShoot();

  player.x += player.dx; player.y += player.dy;
  player.x = clamp(player.x, 0, visibleWidth - player.size);
  player.y = clamp(player.y, topBlackAreaHeight, topBlackAreaHeight + visibleHeight - player.size);
}

function drawPlayer(time) {
  if (player.isMoving && time - player.lastFrameTime > player.frameSpeed) { player.currentFrame = (player.currentFrame + 1) % 4; player.lastFrameTime = time; }
  const arr = playerImages[player.movementDirection];
  const img = arr && arr[player.currentFrame];
  if (player.isInvincible) { ctx.globalAlpha = (Math.floor(time / 100) % 2 === 0) ? 0.5 : 1; } else { ctx.globalAlpha = 1; }
  if (img) { ctx.drawImage(img, player.x, player.y, player.size, player.size); } else { ctx.fillStyle = "#2ecc71"; ctx.fillRect(player.x, player.y, player.size, player.size); }
  ctx.globalAlpha = 1;
}

// --- UI ----------------------------------------------------------------------
function drawBackground() {
  if (bgLoaded && backgroundImage.width > 0 && backgroundImage.height > 0) {
    const imgRatio = backgroundImage.width / backgroundImage.height;
    const canvasRatio = canvas.width / canvas.height;
    let drawW, drawH, offX = 0, offY = 0;
    if (canvasRatio > imgRatio) { drawH = canvas.height; drawW = backgroundImage.width * (drawH / backgroundImage.height); offX = (canvas.width - drawW) / 2; }
    else { drawW = canvas.width; drawH = backgroundImage.height * (drawW / backgroundImage.width); offY = (canvas.height - drawH) / 2; }
    ctx.drawImage(backgroundImage, offX, offY, drawW, drawH);
  } else { ctx.fillStyle = "#1e1e1e"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.fillStyle = "transparent";
  ctx.fillRect(0, 0, canvas.width, topBlackAreaHeight);
  ctx.fillRect(0, canvas.height - bottomBlackAreaHeight, canvas.width, bottomBlackAreaHeight);
}
function drawScore() { ctx.font = "30px Arial"; ctx.fillStyle = "white"; ctx.fillText("Score: " + score, 14, 36); }
function drawHealthBarAbovePlayer() {
  const barWidth = player.size, barHeight = 10, barX = player.x, barY = player.y - 15;
  ctx.fillStyle = "grey"; ctx.fillRect(barX, barY, barWidth, barHeight);
  const healthPercent = player.health / player.maxHealth;
  ctx.fillStyle = healthPercent > 0.5 ? "limegreen" : healthPercent > 0.25 ? "yellow" : "red";
  ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
  ctx.strokeStyle = "black"; ctx.lineWidth = 2; ctx.strokeRect(barX, barY, barWidth, barHeight);
}

function drawGameOver() {
  ctx.font = "60px Arial"; ctx.fillStyle = "red"; ctx.fillText("GAME OVER", canvas.width / 2 - 180, canvas.height / 2);
  ctx.font = "30px Arial"; ctx.fillStyle = "white"; ctx.fillText("Press R to restart", canvas.width / 2 - 130, canvas.height / 2 + 50);
}

// --- Restart -----------------------------------------------------------------
function restartGame() {
  score = 0; gameOver = false;
  player.x = visibleWidth / 2; player.y = topBlackAreaHeight + visibleHeight / 2;
  player.dx = 0; player.dy = 0; player.lastShotTime = 0;
  playerLasers.length = 0; enemies.length = 0;
  player.health = player.maxHealth; player.isInvincible = false; lastSpawnTime = 0;
}

// --- Resize ------------------------------------------------------------------
function updateVisibleArea() {
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  visibleWidth = canvas.width; visibleHeight = canvas.height - topBlackAreaHeight - bottomBlackAreaHeight;
  player.x = clamp(player.x, 0, visibleWidth - player.size);
  player.y = clamp(player.y, topBlackAreaHeight, topBlackAreaHeight + visibleHeight - player.size);
}
window.addEventListener("resize", updateVisibleArea);
updateVisibleArea();

// --- Main Loop ---------------------------------------------------------------
function gameLoop(time) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  // Invincibility timeout
  if (player.isInvincible && performance.now() - player.lastHitTime > player.invincibilityDuration) { player.isInvincible = false; }

  if (!gameOver) {
    updatePlayer();
    updateEnemies();
    updateLasers();
    handleCollisions();

    drawEnemies();
    drawPlayer(time);
    drawLasers();
    drawScore();
    drawHealthBarAbovePlayer();
  } else {
    drawGameOver();
  }
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
// === End =====================================================================