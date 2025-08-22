const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Set canvas size
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Define top and bottom black bars
const topBlackAreaHeight = 400;
const bottomBlackAreaHeight = 150;

// Playable area size
const visibleWidth = canvas.width;
const visibleHeight = canvas.height - topBlackAreaHeight - bottomBlackAreaHeight;

// Player
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: 80,
    speed: 5,
    dx: 0,
    dy: 0,
    currentFrame: 0,
    frameSpeed: 120, // ms per frame for sprite cycle
    lastFrameTime: 0,
    movementDirection: "down",
    isMoving: false,
    health : 3 // player starts with 3 health
};

let score = 0;
let gameOver = false;

// Food
const food = {
    x: Math.random() * visibleWidth,
    y: Math.random() * visibleHeight + topBlackAreaHeight,
    size: 20,
};

// Lasers
const laserSpeed = 5;
const laserSize = 10;
const playerLasers = [];
const enemyLasers = [];

// Sprites
const playerImages = { up: [], down: [], left: [], right: [] };
const backgroundImage = new Image();
backgroundImage.src = "img/bg.jpg";

// Load player images
async function loadPlayerImages() {
    const loadImage = (src) => new Promise((res, rej) => {
        const img = new Image();
        img.src = src;
        img.onload = () => res(img);
        img.onerror = () => rej(src);
    });
    for (let i = 1; i <= 4; i++) {
        playerImages.up.push(await loadImage(`img/u${i}.png`));
        playerImages.down.push(await loadImage(`img/d${i}.png`));
        playerImages.left.push(await loadImage(`img/l${i}.png`));
        playerImages.right.push(await loadImage(`img/r${i}.png`));
    }
    requestAnimationFrame(gameLoop);
}

// Movement keys
let keys = {};
document.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (e.key === "i" || e.key === "I") createLaser();
    if (e.key === "ArrowUp") { player.dy = -player.speed; player.movementDirection = "up"; }
    if (e.key === "ArrowDown") { player.dy = player.speed; player.movementDirection = "down"; }
    if (e.key === "ArrowLeft") { player.dx = -player.speed; player.movementDirection = "left"; }
    if (e.key === "ArrowRight") { player.dx = player.speed; player.movementDirection = "right"; }
    player.isMoving = true;
});
document.addEventListener("keyup", (e) => {
    keys[e.key] = false;
    if (!keys["ArrowUp"] && !keys["ArrowDown"]) player.dy = 0;
    if (!keys["ArrowLeft"] && !keys["ArrowRight"]) player.dx = 0;
    player.isMoving = keys["ArrowUp"] || keys["ArrowDown"] || keys["ArrowLeft"] || keys["ArrowRight"];
});

// Update player
function updatePlayer() {
    player.x += player.dx;
    player.y += player.dy;
    player.x = Math.max(0, Math.min(player.x, visibleWidth - player.size));
    player.y = Math.max(topBlackAreaHeight, Math.min(player.y, topBlackAreaHeight + visibleHeight - player.size));
}

// Draw player
function drawPlayer(time) {
    if (player.isMoving && time - player.lastFrameTime > player.frameSpeed) {
        player.currentFrame = (player.currentFrame + 1) % 4;
        player.lastFrameTime = time;
    }
    const img = playerImages[player.movementDirection][player.currentFrame];
    ctx.drawImage(img, player.x, player.y, player.size, player.size);
}

// Food
function drawFood() {
    ctx.fillStyle = "#e74c3c";
    ctx.beginPath();
    ctx.arc(food.x, food.y, food.size, 0, Math.PI * 2);
    ctx.fill();
}

function checkFoodCollision() {
    const dx = player.x + player.size / 2 - food.x;
    const dy = player.y + player.size / 2 - food.y;
    if (Math.sqrt(dx * dx + dy * dy) < player.size / 2 + food.size / 2) {
        score++;
        food.x = Math.random() * (visibleWidth - food.size);
        food.y = Math.random() * (visibleHeight - food.size) + topBlackAreaHeight;
    }
}

// Lasers
function createLaser() {
    const laser = { x: player.x + player.size / 2, y: player.y + player.size / 2, dx: 0, dy: 0, size: laserSize };
    if (player.movementDirection === "up") laser.dy = -laserSpeed;
    if (player.movementDirection === "down") laser.dy = laserSpeed;
    if (player.movementDirection === "left") laser.dx = -laserSpeed;
    if (player.movementDirection === "right") laser.dx = laserSpeed;
    playerLasers.push(laser);
}
function createEnemyLaser() {
    const laser = { x: food.x, y: food.y, dx: (player.x - food.x) / 50, dy: (player.y - food.y) / 50, size: laserSize };
    enemyLasers.push(laser);
}
function updateLasers() {
    [playerLasers, enemyLasers].forEach(list => {
        for (let i = list.length - 1; i >= 0; i--) {
            list[i].x += list[i].dx;
            list[i].y += list[i].dy;
            if (list[i].x < 0 || list[i].x > canvas.width || list[i].y < 0 || list[i].y > canvas.height) {
                list.splice(i, 1);
            }
        }
    });
}
function drawLasers() {
    playerLasers.forEach(l => { ctx.fillStyle = "blue"; ctx.beginPath(); ctx.arc(l.x, l.y, l.size, 0, Math.PI * 2); ctx.fill(); });
    enemyLasers.forEach(l => { ctx.fillStyle = "red"; ctx.beginPath(); ctx.arc(l.x, l.y, l.size, 0, Math.PI * 2); ctx.fill(); });
}

// Laser collisions
function checkLaserCollisions() {
    // Player lasers vs food
    for (let i = playerLasers.length - 1; i >= 0; i--) {
        const l = playerLasers[i];
        const dx = l.x - food.x, dy = l.y - food.y;
        if (Math.sqrt(dx * dx + dy * dy) < food.size / 2 + l.size / 2) {
            score++;
            food.x = Math.random() * (visibleWidth - food.size);
            food.y = Math.random() * (visibleHeight - food.size) + topBlackAreaHeight;
            playerLasers.splice(i, 1);
        }
    }
    // Enemy lasers vs player
    for (let i = enemyLasers.length - 1; i >= 0; i--) {
        const l = enemyLasers[i];
        const dx = l.x - (player.x + player.size / 2), dy = l.y - (player.y + player.size / 2);
        if (Math.sqrt(dx * dx + dy * dy) < player.size / 2 + l.size / 2) {
            player.health--;
            enemyLasers.splice(i, 1);
            if (player.health <= 0){
               gameOver = true; 
            }
            
        }
    }
}

// Draw background
function drawBackground() {
    const imgRatio = backgroundImage.width / backgroundImage.height;
    const canvasRatio = canvas.width / canvas.height;
    let drawW, drawH, offX = 0, offY = 0;
    if (canvasRatio > imgRatio) {
        drawH = canvas.height;
        drawW = backgroundImage.width * (drawH / backgroundImage.height);
        offX = (canvas.width - drawW) / 2;
    } else {
        drawW = canvas.width;
        drawH = backgroundImage.height * (drawW / backgroundImage.width);
        offY = (canvas.height - drawH) / 2;
    }
    ctx.drawImage(backgroundImage, offX, offY, drawW, drawH);
}

// Score & Game Over text
function drawScore() {
    ctx.font = "30px Arial";
    ctx.fillStyle = "white";
    ctx.fillText("Score: " + score, 10, 30);
}
function drawGameOver() {
    ctx.font = "60px Arial";
    ctx.fillStyle = "red";
    ctx.fillText("GAME OVER", canvas.width / 2 - 180, canvas.height / 2);
    ctx.font = "30px Arial";
    ctx.fillStyle = "white";
    ctx.fillText("Press R to restart", canvas.width / 2 - 130, canvas.height / 2 + 50);
}

document.addEventListener("keydown", (e) => {
    if (gameOver && (e.key === "r" || e.key === "R")) {
        score = 0;
        gameOver = false;
        player.x = canvas.width / 2;
        player.y = canvas.height / 2;
        playerLasers.length = 0;
        enemyLasers.length = 0;
        player.health = 3; //reset health
    }
});

// NEW: draw hearts for health
function drawHealth() {
    const heartSize = 45; // pixel size of hearts
    const heartSpacing = 40; // distance between hearts
    ctx.font = heartSize + "px Arial";
    ctx.fillStyle = "red";

    for (let i = 0; i < player.health; i++) {
        ctx.fillText("❤️", 10 + i * heartSpacing, 70);
    }
}

// Main loop
function gameLoop(time) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawBackground();

    if (!gameOver) {
        updatePlayer();
        checkFoodCollision();
        checkLaserCollisions();
        updateLasers();

        drawPlayer(time);
        drawFood();
        drawLasers();
        drawScore();
        drawHealth();


        if (Math.random() < 0.01) createEnemyLaser();
    } else {
        drawGameOver();
    }

    requestAnimationFrame(gameLoop);
}

loadPlayerImages();
