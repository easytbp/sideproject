const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Set canvas size
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Define the top and bottom black area boundaries
const topBlackAreaHeight = 400;  // The height of the top black area
const bottomBlackAreaHeight = 150;  // The height of the bottom black area

// Define the visible (playable) area boundaries
const visibleWidth = canvas.width; // Playable width
const visibleHeight = canvas.height - topBlackAreaHeight - bottomBlackAreaHeight; // Playable height, accounting for both black areas

// Player settings
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: 80,
    speed: 5,
    dx: 0,
    dy: 0,
    currentFrame: 0,  // To track the current animation frame
    frameSpeed: 18,  // Speed of frame change (in ms)
    movementDirection: "down",  // Default direction (down)
    isMoving: false, 
};

// Score settings
let score = 0;
let gameOver = false;

// Food settings (the collectible items)
const food = {
    x: Math.random() * visibleWidth, // Spawn within the visible width (playable width)
    y: Math.random() * visibleHeight + topBlackAreaHeight, // Spawn within the visible height (playable height) and respect the top black area
    size: 20,
    lasers: []
};

// Laser settings
const laserSpeed = 5;
const laserSize = 10;

// Player's lasers array
const playerLasers = [];
const enemyLasers = [];

// Load images for different movements (u1-u4, d1-d4, l1-l4, r1r4)
const playerImages = {
    up: [],
    down: [],
    left: [],
    right: []
};

// Background image
const backgroundImage = new Image();
backgroundImage.src = "img/bg.jpg"; // Specify your background image path

// Load images for player movement
async function loadPlayerImages() {
    try {
        for (let i = 1; i <= 4; i++) {
            playerImages.up.push(await loadImage(`img/u${i}.png`));
            playerImages.down.push(await loadImage(`img/d${i}.png`));
            playerImages.left.push(await loadImage(`img/l${i}.png`));
            playerImages.right.push(await loadImage(`img/r${i}.png`));
        }
        startAnimation(); // Start the animation once the images are loaded
    } catch (error) {
        console.error("Error loading images:", error);
    }
}

// Load individual images
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = () => reject(`Failed to load image: ${src}`);
    });
}

// Key press listeners for player movement and laser shooting
let keys = {};  // Object to track the state of each key

document.addEventListener("keydown", (e) => {
    keys[e.key] = true; // Mark key as pressed

    // Check for laser shooting (I key)
    if (e.key === "i" || e.key === "I") {
        createLaser(); // Create laser when "I" key is pressed
    }

    // Update player movement based on the last pressed key
    if (e.key === "ArrowUp" && !keys["ArrowDown"]) { // Only up if not down
        player.dy = -player.speed;
        player.movementDirection = "up"; // Set to 'up' when ArrowUp is pressed
    } else if (e.key === "ArrowDown" && !keys["ArrowUp"]) { // Only down if not up
        player.dy = player.speed;
        player.movementDirection = "down"; // Set to 'down' when ArrowDown is pressed
    } else if (e.key === "ArrowLeft") {
        player.dx = -player.speed;
        player.movementDirection = "left"; // Set to 'left' when ArrowLeft is pressed
    } else if (e.key === "ArrowRight") {
        player.dx = player.speed;
        player.movementDirection = "right"; // Set to 'right' when ArrowRight is pressed
    }

    player.isMoving = true; // Player is moving as a key is pressed
});

document.addEventListener("keyup", (e) => {
    keys[e.key] = false; // Mark key as not pressed

    // Stop player movement when the key is released
    if (e.key === "ArrowUp" || e.key === "ArrowDown") player.dy = 0;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") player.dx = 0;

    // When the player releases a key, check for the direction they are still holding
    if (!keys["ArrowUp"] && !keys["ArrowDown"] && !keys["ArrowLeft"] && !keys["ArrowRight"]) {
        player.isMoving = false; // Stop animation when no keys are pressed
    } else {
        player.isMoving = true; // Keep moving based on the last key pressed
    }

    // Ensure the player keeps facing the direction of the last held key
    if (keys["ArrowUp"]) player.movementDirection = "up";
    if (keys["ArrowDown"]) player.movementDirection = "down";
    if (keys["ArrowLeft"]) player.movementDirection = "left";
    if (keys["ArrowRight"]) player.movementDirection = "right";
});

// Update player position
function updatePlayer() {
    player.x += player.dx;
    player.y += player.dy;

    // Ensure the player stays within the visible (playable) area
    player.x = Math.max(0, Math.min(player.x, visibleWidth - player.size)); // Prevent moving off canvas horizontally
    player.y = Math.max(topBlackAreaHeight, Math.min(player.y, topBlackAreaHeight + visibleHeight - player.size)); // Prevent moving off canvas vertically, respecting the top black area
}

// Draw player based on current direction and frame
function drawPlayer() {
    const directionImages = playerImages[player.movementDirection];
    const currentImage = directionImages[player.currentFrame]; // Select the current frame in the animation
    ctx.drawImage(currentImage, player.x, player.y, player.size, player.size);
}

// Draw food
function drawFood() {
    ctx.fillStyle = "#e74c3c";
    ctx.beginPath();
    ctx.arc(food.x, food.y, food.size, 0, Math.PI * 2);
    ctx.fill();
}

// Draw score
function drawScore() {
    ctx.font = "30px Arial";
    ctx.fillStyle = "#fff"; // Set the score text color to white
    ctx.fillText("Score: " + score, 10, 30);
}

// Check for collision with food
function checkCollision() {
    const distX = player.x + player.size / 2 - food.x;
    const distY = player.y + player.size / 2 - food.y;
    const distance = Math.sqrt(distX * distX + distY * distY);
    if (distance < player.size / 2 + food.size / 2) {
        score++;
        food.x = Math.random() * (visibleWidth - food.size); // Spawn within visible area
        food.y = Math.random() * (visibleHeight - food.size) + topBlackAreaHeight; // Respect the top black area
    }
}

// Create player laser
function createLaser() {
    const laser = {
        x: player.x + player.size / 2,
        y: player.y + player.size / 2,
        dx: 0,
        dy: 0,
        size: laserSize
    };

    // Set laser direction based on player's current movement
    if (player.movementDirection === "up") {
        laser.dy = -laserSpeed;
    } else if (player.movementDirection === "down") {
        laser.dy = laserSpeed;
    } else if (player.movementDirection === "left") {
        laser.dx = -laserSpeed;
    } else if (player.movementDirection === "right") {
        laser.dx = laserSpeed;
    }

    playerLasers.push(laser); // Add laser to player's lasers array
}

// Create enemy laser (from food to player)
function createEnemyLaser() {
    const laser = {
        x: food.x,
        y: food.y,
        dx: (player.x - food.x) / 50, // Moves towards player
        dy: (player.y - food.y) / 50, // Moves towards player
        size: laserSize
    };

    enemyLasers.push(laser); // Add enemy laser to array
}

// Update lasers and move them
function updateLasers() {
    for (let i = 0; i < playerLasers.length; i++) {
        const laser = playerLasers[i];
        laser.x += laser.dx;
        laser.y += laser.dy;
    }

    for (let i = 0; i < enemyLasers.length; i++) {
        const laser = enemyLasers[i];
        laser.x += laser.dx;
        laser.y += laser.dy;
    }
}

// Check for laser collisions with the food and player
function checkLaserCollisions() {
    // --- Player lasers hitting food ---
    for (let i = 0; i < playerLasers.length; i++) {
        const laser = playerLasers[i];
        const distX = laser.x - food.x;
        const distY = laser.y - food.y;
        const distance = Math.sqrt(distX * distX + distY * distY);

        if (distance < food.size / 2 + laser.size / 2) {
            score++; // Increase score
            // Respawn food
            food.x = Math.random() * (visibleWidth - food.size);
            food.y = Math.random() * (visibleHeight - food.size) + topBlackAreaHeight;
            playerLasers.splice(i, 1); // Remove laser after collision
            i--; // Adjust index after removal
        }
    }

    // --- Enemy lasers hitting player ---
    for (let i = 0; i < enemyLasers.length; i++) {
        const laser = enemyLasers[i];
        const distX = laser.x - (player.x + player.size / 2);
        const distY = laser.y - (player.y + player.size / 2);
        const distance = Math.sqrt(distX * distX + distY * distY);

        // Use realistic collision radius: half player size + half laser size
        const collisionRadius = player.size / 2 + laser.size / 2;

        if (distance < collisionRadius) {
            gameOver = true;

            // Visual effect: remove laser that hit the player
            enemyLasers.splice(i, 1);
            i--; // Adjust index

            // Small delay before respawn to see the hit
            setTimeout(() => {
                score = 0;
                alert("Game Over! Score has been reset.");
                respawnPlayer();
            }, 50); // 50ms pause is enough for visual recognition

            break; // Only handle one collision at a time
        }
    }
}

// Draw lasers
function drawLasers() {
    // Draw player's lasers (blue)
    for (let i = 0; i < playerLasers.length; i++) {
        const laser = playerLasers[i];
        ctx.fillStyle = "blue"; // Player's laser color
        ctx.beginPath();
        ctx.arc(laser.x, laser.y, laser.size, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw enemy's lasers (red)
    for (let i = 0; i < enemyLasers.length; i++) {
        const laser = enemyLasers[i];
        ctx.fillStyle = "red"; // Enemy's laser color
        ctx.beginPath();
        ctx.arc(laser.x, laser.y, laser.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Draw background and game elements
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas for next frame

    // Draw the background
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height); // Fill entire canvas with black

    drawBackground();  // Draw the background

    updatePlayer();
    checkCollision();
    checkLaserCollisions(); // Check laser collisions with food
    updateLasers(); // Update laser positions

    drawPlayer();  // Draw player
    drawFood();    // Draw food
    drawScore();   // Draw score
    drawLasers();  // Draw lasers

    // Create enemy lasers randomly
    if (Math.random() < 0.01 && !gameOver) {
        createEnemyLaser();
    }
}

// Draw the background image and maintain aspect ratio
function drawBackground() {
    const imgWidth = backgroundImage.width;
    const imgHeight = backgroundImage.height;
    const canvasRatio = canvas.width / canvas.height;
    const imgRatio = imgWidth / imgHeight;

    let drawWidth, drawHeight, offsetX, offsetY;

    if (canvasRatio > imgRatio) {
        drawHeight = canvas.height;
        drawWidth = imgWidth * (drawHeight / imgHeight);
        offsetX = (canvas.width - drawWidth) / 2;
        offsetY = 0;
    } else {
        drawWidth = canvas.width;
        drawHeight = imgHeight * (drawWidth / imgWidth);
        offsetX = 0;
        offsetY = (canvas.height - drawHeight) / 2;
    }

    ctx.drawImage(backgroundImage, offsetX, offsetY, drawWidth, drawHeight);
}

// Respawn the player at a random position
function respawnPlayer() {
    const buffer = 100;
    let randomX, randomY;

    // Reset movement state
    player.dx = 0;
    player.dy = 0;
    player.isMoving = false;
    keys = {}; // Reset the keys object to ensure no key is pressed

    do {
        randomX = Math.random() * (visibleWidth - player.size);
        randomY = Math.random() * (visibleHeight - player.size);
    } while (Math.abs(randomX - food.x) < buffer && Math.abs(randomY - food.y) < buffer);

    player.x = randomX;
    player.y = randomY;

    gameOver = false;  // Reset the gameOver flag to allow lasers again
}

// Start animation with setInterval to control frame rate
function startAnimation() {
    setInterval(() => {
        if (player.isMoving) {
            player.currentFrame = (player.currentFrame + 1) % 4;  // Cycle through 4 frames
        }
        gameLoop();
    }, player.frameSpeed);  // 100ms frame update for fast animation
}

// Start the image loading and then the animation loop
loadPlayerImages();
