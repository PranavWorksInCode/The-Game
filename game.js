// Default Map Data
let mapData = {
    blocks: [
        // Outer Walls
        { x: 0, y: 0, z: -10, w: 20, h: 5, d: 1, color: 0x555555 },
        { x: 0, y: 0, z: 10, w: 20, h: 5, d: 1, color: 0x555555 },
        { x: -10, y: 0, z: 0, w: 1, h: 5, d: 20, color: 0x555555 },
        { x: 10, y: 0, z: 0, w: 1, h: 5, d: 20, color: 0x555555 },
        
        // Platforming Boxes
        { x: -5, y: 0, z: -5, w: 2, h: 1, d: 2, color: 0xff0000 },
        { x: -2, y: 0, z: -5, w: 2, h: 2, d: 2, color: 0x00ff00 },
        { x: 1,  y: 0, z: -5, w: 2, h: 3, d: 2, color: 0x0000ff },
        { x: 4,  y: 0, z: -5, w: 2, h: 4, d: 2, color: 0xffff00 },
        
        // Floating steps
        { x: -5, y: 2, z: 2, w: 2, h: 0.5, d: 2, color: 0xff00ff },
        { x: -2, y: 3.5, z: 2, w: 2, h: 0.5, d: 2, color: 0x00ffff },
    ]
};

// Player State
const player = {
    x: 0,
    y: 0,
    z: 5,
    yaw: 0,
    pitch: 0,
    yVelocity: 0,
    vx: 0,
    vz: 0,
    isGrounded: true,
    eyeHeight: 1.6,
    radius: 0.3,
    moveSpeed: 8.0,
    jumpVelocity: 14.0,
    health: 100,
    maxHealth: 100
};

// Enemies
let enemies = [
    { id: 1, x: -5, y: 0, z: -8, hp: 150, maxHp: 150, type: 'mover', speed: 4.0, nextShoot: 0 },
    { id: 2, x: 5,  y: 0, z: -8, hp: 2000, maxHp: 2000, type: 'tank', speed: 0.0, nextShoot: 0 }
];

// Load Custom Map from Local Storage V3
const savedMapStr = localStorage.getItem('customMapV3');
if (savedMapStr) {
    try {
        const savedData = JSON.parse(savedMapStr);
        mapData = savedData;
        
        enemies = [];
        for(let obj of mapData.objects) {
            if (obj.type === 'mover' || obj.type === 'tank') {
                obj.y = 0; // Flat world
                obj.maxHp = obj.hp;
                obj.nextShoot = 0;
                enemies.push(obj);
            }
        }
        
        if (savedData.playerStart) {
            player.x = savedData.playerStart.x;
            player.z = savedData.playerStart.z;
            player.y = 0;
            if (savedData.playerStart.hp) {
                player.health = savedData.playerStart.hp;
                player.maxHealth = savedData.playerStart.hp;
            }
            if (savedData.playerStart.speed) player.moveSpeed = savedData.playerStart.speed;
            if (savedData.playerStart.jumpVelocity) player.jumpVelocity = savedData.playerStart.jumpVelocity;
            
            if (savedData.playerStart.weapons) {
                weapons = allWeapons.filter(w => w.name === 'Fists' || savedData.playerStart.weapons.includes(w.name));
            }
            
            if (savedData.playerStart.powers) {
                powerups.rewind.unlocked = savedData.playerStart.powers.includes('rewind');
                powerups.timeDilation.unlocked = savedData.playerStart.powers.includes('timeDilation');
                powerups.healthUp.unlocked = savedData.playerStart.powers.includes('healthUp');
                powerups.doubleDamage.unlocked = savedData.playerStart.powers.includes('doubleDamage');
            }
        }
        console.log("Loaded custom map V3!");
    } catch(e) {
        console.error("Failed to load map data V3");
    }
}

let projectiles = [];

// Weapons Data
const allWeapons = [
    { name: 'Fists', damage: 5, ammo: Infinity, maxAmmo: Infinity, magSize: Infinity, currentMag: Infinity, dropOff: false, fireRate: 0.4 },
    { name: 'Pistol', damage: 25, ammo: 60, maxAmmo: 60, magSize: 10, currentMag: 10, dropOff: false, fireRate: 0.3 },
    { name: 'Shotgun', damage: 40, ammo: 30, maxAmmo: 30, magSize: 5, currentMag: 5, dropOff: true, fireRate: 0.8 },
    { name: 'Assault Rifle', damage: 30, ammo: 120, maxAmmo: 120, magSize: 30, currentMag: 30, dropOff: false, fireRate: 0.1 },
    { name: 'Machine Gun', damage: 35, ammo: 300, maxAmmo: 300, magSize: 150, currentMag: 150, dropOff: false, fireRate: 0.05 },
    { name: 'Rocket Launcher', damage: 150, ammo: 5, maxAmmo: 5, magSize: 1, currentMag: 1, dropOff: false, fireRate: 1.5 }
];
let weapons = [...allWeapons];
let currentWeaponIndex = 0; // Default index

let lastShootTime = 0; // Cooldown tracker

// Powerups System
const powerups = {
    rewind: {
        unlocked: true,
        history: [],
        maxFrames: 600, // 10 seconds at 60 FPS
        cooldown: 150,
        lastUsed: -Infinity,
        isRewinding: false
    },
    timeDilation: {
        unlocked: true,
        active: false,
        duration: 10,
        cooldown: 90,
        lastUsed: -Infinity,
        timer: 0
    },
    doubleDamage: {
        unlocked: true,
        active: false,
        duration: 10,
        cooldown: 60,
        lastUsed: -Infinity,
        timer: 0
    },
    healthUp: {
        unlocked: true,
        active: false,
        duration: 15,
        cooldown: 90,
        lastUsed: -Infinity,
        timer: 0,
        damageTakenDuring: 0
    }
};

// UI Elements
const healthBar = document.getElementById('health-bar');
const weaponInfo = document.getElementById('weapon-info');
const powerupInfo = document.getElementById('powerup-info');

function updateHUD(timeNow) {
    healthBar.innerText = `Health: ${player.health}`;
    let w = weapons[currentWeaponIndex];
    if (w.name === 'Fists') {
        weaponInfo.innerText = `${w.name} | Ammo: Infinite`;
    } else {
        weaponInfo.innerText = `${w.name} | Ammo: ${w.currentMag}/${w.ammo}`;
    }
    
    // Update Powerups HUD
    let lines = [];
    
    // Rewind [Q]
    let cdRw = Math.max(0, powerups.rewind.cooldown - (timeNow - powerups.rewind.lastUsed));
    if (powerups.rewind.isRewinding) lines.push("<span style='color:#f0f'>[Q] REWINDING</span>");
    else lines.push(cdRw > 0 ? `<span style='color:#888'>[Q] Rewind CD: ${Math.ceil(cdRw)}s</span>` : "<span style='color:#0ff'>[Q] Rewind READY</span>");

    // Time Dilation [E]
    let cdTd = Math.max(0, powerups.timeDilation.cooldown - (timeNow - powerups.timeDilation.lastUsed));
    if (powerups.timeDilation.active) lines.push(`<span style='color:#ff0'>[E] TIME SLOW: ${Math.ceil(powerups.timeDilation.timer)}s</span>`);
    else lines.push(cdTd > 0 ? `<span style='color:#888'>[E] Slow CD: ${Math.ceil(cdTd)}s</span>` : "<span style='color:#0ff'>[E] Slow READY</span>");

    // Double Damage [Z]
    let cdDd = Math.max(0, powerups.doubleDamage.cooldown - (timeNow - powerups.doubleDamage.lastUsed));
    if (powerups.doubleDamage.active) lines.push(`<span style='color:#f00'>[Z] DOUBLE DMG: ${Math.ceil(powerups.doubleDamage.timer)}s</span>`);
    else lines.push(cdDd > 0 ? `<span style='color:#888'>[Z] Dmg CD: ${Math.ceil(cdDd)}s</span>` : "<span style='color:#0ff'>[Z] Dmg READY</span>");

    // Health Up [X]
    let cdHu = Math.max(0, powerups.healthUp.cooldown - (timeNow - powerups.healthUp.lastUsed));
    if (powerups.healthUp.active) lines.push(`<span style='color:#0f0'>[X] HEALTH UP: ${Math.ceil(powerups.healthUp.timer)}s</span>`);
    else lines.push(cdHu > 0 ? `<span style='color:#888'>[X] Health CD: ${Math.ceil(cdHu)}s</span>` : "<span style='color:#0ff'>[X] Health READY</span>");

    powerupInfo.innerHTML = lines.join('<br>');
}
updateHUD(0);

// Input State
const keys = { w: false, a: false, s: false, d: false, space: false, q: false, e: false, z: false, x: false };
let flashTimer = 0;

// Initialization
const canvas = document.getElementById('game-canvas');
const engine = new Engine(canvas, mapData);

// Event Listeners
window.addEventListener('keydown', (e) => {
    if (e.key === 'w' || e.key === 'W') keys.w = true;
    if (e.key === 's' || e.key === 'S') keys.s = true;
    if (e.key === 'a' || e.key === 'A') keys.a = true;
    if (e.key === 'd' || e.key === 'D') keys.d = true;
    if (e.key === ' ') keys.space = true;
    if (e.key === 'q' || e.key === 'Q') keys.q = true;
    if (e.key === 'e' || e.key === 'E') keys.e = true;
    if (e.key === 'z' || e.key === 'Z') keys.z = true;
    if (e.key === 'x' || e.key === 'X') keys.x = true;
    
    // Level Editor Hotkey
    if (e.key === 'm' || e.key === 'M') {
        window.location.href = 'editor.html';
    }
    
    if (e.key >= '1' && e.key <= '6') {
        let newIdx = parseInt(e.key) - 1;
        if (newIdx < weapons.length) {
            currentWeaponIndex = newIdx;
            updateHUD(performance.now() / 1000);
        }
    }
    if (e.key === 'r' || e.key === 'R') {
        let w = weapons[currentWeaponIndex];
        if (w.name !== 'Fists' && w.ammo > 0 && w.currentMag < w.magSize) {
            let needed = w.magSize - w.currentMag;
            let available = Math.min(needed, w.ammo);
            w.currentMag += available;
            w.ammo -= available;
            updateHUD(performance.now() / 1000);
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'W') keys.w = false;
    if (e.key === 's' || e.key === 'S') keys.s = false;
    if (e.key === 'a' || e.key === 'A') keys.a = false;
    if (e.key === 'd' || e.key === 'D') keys.d = false;
    if (e.key === ' ') keys.space = false;
    if (e.key === 'q' || e.key === 'Q') keys.q = false;
    if (e.key === 'e' || e.key === 'E') keys.e = false;
    if (e.key === 'z' || e.key === 'Z') keys.z = false;
    if (e.key === 'x' || e.key === 'X') keys.x = false;
});

// Mouse State
let isMouseDown = false;

// Mouse Looking and Shooting
canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;

document.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
        return;
    }
    if (e.button === 0) {
        isMouseDown = true;
        shootWeapon(); // Snappy initial shot
    }
});

document.addEventListener('mouseup', (e) => {
    if (e.button === 0) isMouseDown = false;
});

function shootWeapon() {
    let w = weapons[currentWeaponIndex];
    let now = performance.now() / 1000;
    
    if (now - lastShootTime < w.fireRate) return;
    
    if (w.name !== 'Fists') {
        if (w.currentMag <= 0) return;
        w.currentMag--;
    }
    
    lastShootTime = now;
    flashTimer = 0.05;
    updateHUD(now);
    
    let dmg = w.damage;
    if (powerups.doubleDamage.active) dmg *= 2; // Double Damage Powerup!

    if (w.name === 'Fists') {
        // Melee is instant
        for(let enemy of enemies) {
            if (enemy.hp <= 0) continue;
            let dx = enemy.x - player.x;
            let dz = enemy.z - player.z;
            if (Math.sqrt(dx*dx + dz*dz) < 2.5) { // Melee range
                enemy.hp -= dmg;
                if (enemy.hp < 0) enemy.hp = 0;
            }
        }
    } else {
        // Use Three.js to get the EXACT forward vector of the camera
        let dir = new THREE.Vector3();
        engine.camera.rotation.order = 'YXZ';
        engine.camera.rotation.y = player.yaw;
        engine.camera.rotation.x = player.pitch;
        engine.camera.getWorldDirection(dir);
        
        let dirX = dir.x;
        let dirY = dir.y;
        let dirZ = dir.z;
        let projSpeed = 40;
        
        // Spawn slightly in front so we don't shoot from inside our own head
        let spawnX = player.x + dirX * 0.5;
        let spawnY = player.y + player.eyeHeight + dirY * 0.5;
        let spawnZ = player.z + dirZ * 0.5;

        if (w.name === 'Shotgun') {
            for(let i=0; i<5; i++) {
                let sx = dirX + (Math.random()-0.5)*0.2;
                let sy = dirY + (Math.random()-0.5)*0.2;
                let sz = dirZ + (Math.random()-0.5)*0.2;
                let len = Math.sqrt(sx*sx + sy*sy + sz*sz);
                projectiles.push({
                    x: spawnX, y: spawnY, z: spawnZ,
                    vx: (sx/len) * projSpeed + player.vx, 
                    vy: (sy/len) * projSpeed + player.yVelocity, 
                    vz: (sz/len) * projSpeed + player.vz,
                    active: true, owner: 'player', damage: dmg
                });
            }
        } else if (w.name === 'Rocket Launcher') {
            projectiles.push({
                x: spawnX, y: spawnY, z: spawnZ,
                vx: dirX * 15 + player.vx, 
                vy: dirY * 15 + player.yVelocity, 
                vz: dirZ * 15 + player.vz,
                active: true, owner: 'player', damage: dmg
            });
        } else {
            // Pistol, AR, Machine Gun
            projectiles.push({
                x: spawnX, y: spawnY, z: spawnZ,
                vx: dirX * projSpeed + player.vx, 
                vy: dirY * projSpeed + player.yVelocity, 
                vz: dirZ * projSpeed + player.vz,
                active: true, owner: 'player', damage: dmg
            });
        }
    }
}

document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
        player.yaw -= e.movementX * 0.002;
        player.pitch -= e.movementY * 0.002;
        
        // Clamp pitch to straight up/down
        if (player.pitch > Math.PI / 2) player.pitch = Math.PI / 2;
        if (player.pitch < -Math.PI / 2) player.pitch = -Math.PI / 2;
    }
});

// Physics and Collision via THREE.Raycaster
const physicsRay = new THREE.Raycaster();

function checkLineOfSight(x1, y1, z1, x2, y2, z2) {
    let origin = new THREE.Vector3(x1, y1, z1);
    let target = new THREE.Vector3(x2, y2, z2);
    let dir = target.clone().sub(origin);
    let dist = dir.length();
    dir.normalize();
    
    physicsRay.set(origin, dir);
    let hits = physicsRay.intersectObjects(engine.collisionMeshes, true);
    
    if (hits.length > 0 && hits[0].distance < dist) {
        return false; // Hit a wall before reaching target
    }
    return true;
}

function movePlayer(dx, dy, dz) {
    // Horizontal Movement (X/Z)
    if (Math.abs(dx) > 0.001) {
        let dirX = dx > 0 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(-1,0,0);
        physicsRay.set(new THREE.Vector3(player.x, player.y + 0.5, player.z), dirX);
        let hits = physicsRay.intersectObjects(engine.collisionMeshes, true);
        if (hits.length > 0 && hits[0].distance < player.radius + Math.abs(dx)) dx = 0;
    }
    
    if (Math.abs(dz) > 0.001) {
        let dirZ = dz > 0 ? new THREE.Vector3(0,0,1) : new THREE.Vector3(0,0,-1);
        physicsRay.set(new THREE.Vector3(player.x + dx, player.y + 0.5, player.z), dirZ);
        let hits = physicsRay.intersectObjects(engine.collisionMeshes, true);
        if (hits.length > 0 && hits[0].distance < player.radius + Math.abs(dz)) dz = 0;
    }
    
    player.x += dx;
    player.z += dz;
    
    // Vertical Movement & Ramps (Y)
    player.y += dy;
    
    let rayOrigin = new THREE.Vector3(player.x, player.y + player.eyeHeight, player.z);
    physicsRay.set(rayOrigin, new THREE.Vector3(0, -1, 0));
    let hits = physicsRay.intersectObjects(engine.collisionMeshes, true);
    
    player.isGrounded = false;
    
    if (hits.length > 0) {
        let groundY = hits[0].point.y;
        if (player.y <= groundY + 0.1) { // Snap to ramp
            player.y = groundY;
            if (dy <= 0) {
                player.yVelocity = 0;
                player.isGrounded = true;
            }
        }
    } else if (player.y < -50) {
        player.y = 0; // fallback
        player.yVelocity = 0;
    }
    
    // Check ceiling
    if (dy > 0) {
        physicsRay.set(rayOrigin, new THREE.Vector3(0, 1, 0));
        let upHits = physicsRay.intersectObjects(engine.collisionMeshes, true);
        if (upHits.length > 0 && upHits[0].distance < 0.2) player.yVelocity = 0;
    }
}

// Game Loop
let lastTime = 0;
function gameLoop(time) {
    let now = time / 1000.0;
    let dt = now - lastTime;
    if (dt > 0.1) dt = 0.1; // Limit dt
    lastTime = now;

    // --- REWIND LOGIC ---
    if (powerups.rewind.unlocked && keys.q && now - powerups.rewind.lastUsed >= powerups.rewind.cooldown) {
        powerups.rewind.isRewinding = true;
    } else if (!keys.q && powerups.rewind.isRewinding) {
        powerups.rewind.isRewinding = false;
        powerups.rewind.lastUsed = now; // Start cooldown when key is released
        powerups.rewind.history = []; // Clear future history
    }

    if (powerups.rewind.isRewinding) {
        if (powerups.rewind.history.length > 0) {
            // Apply historic state
            let state = powerups.rewind.history.pop();
            player.x = state.x;
            player.y = state.y;
            player.z = state.z;
            player.yaw = state.yaw;
            player.pitch = state.pitch;
            player.yVelocity = state.yVelocity;
            
            // Screen effect for rewinding
            document.getElementById('flash-overlay').style.backgroundColor = 'rgba(255, 0, 255, 0.2)';
        } else {
            // Reached max rewind limit
            powerups.rewind.isRewinding = false;
            powerups.rewind.lastUsed = now;
        }
    } else {
        // --- NORMAL GAMEPLAY LOGIC ---
        // Save current state to history
        if (powerups.rewind.unlocked) {
            powerups.rewind.history.push({
                x: player.x, y: player.y, z: player.z,
                yaw: player.yaw, pitch: player.pitch, yVelocity: player.yVelocity
            });
            if (powerups.rewind.history.length > powerups.rewind.maxFrames) {
                powerups.rewind.history.shift();
            }
        }

        // --- POWERUPS LOGIC & TIMERS ---
        let timeDilationFactor = 1.0;
        
        // Time Dilation
        if (powerups.timeDilation.unlocked && keys.e && now - powerups.timeDilation.lastUsed >= powerups.timeDilation.cooldown) {
            powerups.timeDilation.active = true;
            powerups.timeDilation.lastUsed = now;
            powerups.timeDilation.timer = powerups.timeDilation.duration;
        }
        if (powerups.timeDilation.active) {
            timeDilationFactor = 0.3; // Slow enemies by 70%
            powerups.timeDilation.timer -= dt;
            if (powerups.timeDilation.timer <= 0) powerups.timeDilation.active = false;
        }

        // Double Damage
        if (powerups.doubleDamage.unlocked && keys.z && now - powerups.doubleDamage.lastUsed >= powerups.doubleDamage.cooldown) {
            powerups.doubleDamage.active = true;
            powerups.doubleDamage.lastUsed = now;
            powerups.doubleDamage.timer = powerups.doubleDamage.duration;
        }
        if (powerups.doubleDamage.active) {
            powerups.doubleDamage.timer -= dt;
            if (powerups.doubleDamage.timer <= 0) powerups.doubleDamage.active = false;
        }

        // Health Up
        if (powerups.healthUp.unlocked && keys.x && now - powerups.healthUp.lastUsed >= powerups.healthUp.cooldown) {
            powerups.healthUp.active = true;
            powerups.healthUp.lastUsed = now;
            powerups.healthUp.timer = powerups.healthUp.duration;
            player.health += player.maxHealth * 0.5; // Gain 50% health
            powerups.healthUp.damageTakenDuring = 0;
        }
        if (powerups.healthUp.active) {
            powerups.healthUp.timer -= dt;
            if (powerups.healthUp.timer <= 0) {
                powerups.healthUp.active = false;
                // Reflect damage taken back onto player
                if (powerups.healthUp.damageTakenDuring > 0) {
                    player.health -= powerups.healthUp.damageTakenDuring;
                    if (player.health < 1) player.health = 1; // Prevents instant death from reflection
                }
            }
        }

        // --- PHYSICS ---
        player.yVelocity -= 30 * dt; // Gravity
        
        let moveX = 0;
        let moveZ = 0;
        
        if (keys.w) { moveX -= Math.sin(player.yaw); moveZ -= Math.cos(player.yaw); }
        if (keys.s) { moveX += Math.sin(player.yaw); moveZ += Math.cos(player.yaw); }
        if (keys.a) { moveX -= Math.cos(player.yaw); moveZ += Math.sin(player.yaw); }
        if (keys.d) { moveX += Math.cos(player.yaw); moveZ -= Math.sin(player.yaw); }
        
        let length = Math.sqrt(moveX*moveX + moveZ*moveZ);
        if (length > 0) {
            moveX = (moveX / length) * player.moveSpeed;
            moveZ = (moveZ / length) * player.moveSpeed;
        }
        player.vx = moveX;
        player.vz = moveZ;
        
        if (keys.space && player.isGrounded) {
            player.yVelocity = player.jumpVelocity;
            player.isGrounded = false;
        }
        
        let dy = player.yVelocity * dt;
        movePlayer(player.vx * dt, dy, player.vz * dt);
        
        // --- AUTO SHOOTING ---
        if (isMouseDown) {
            let w = weapons[currentWeaponIndex];
            if (w.name === 'Machine Gun' || w.name === 'Assault Rifle') {
                shootWeapon();
            }
        }
        
        // --- ENEMIES & COMBAT ---
        for(let enemy of enemies) {
            if (enemy.hp <= 0) continue;
            
            // Initialize AI states if missing
            if (!enemy.aiState) {
                enemy.aiState = 'idle';
                enemy.lastKnownX = enemy.x;
                enemy.lastKnownZ = enemy.z;
            }
            
            let dx = player.x - enemy.x;
            let edy = (player.y + player.eyeHeight) - (enemy.y + 1);
            let dz = player.z - enemy.z;
            let dist = Math.sqrt(dx*dx + edy*edy + dz*dz);
            
            // Line of sight check
            let hasLOS = checkLineOfSight(enemy.x, enemy.y + 1.0, enemy.z, player.x, player.y + player.eyeHeight, player.z);
            
            if (hasLOS) {
                enemy.aiState = 'chase';
                enemy.lastKnownX = player.x;
                enemy.lastKnownZ = player.z;
            } else if (enemy.aiState === 'chase') {
                enemy.aiState = 'search';
            }
            
            let moveSpeed = enemy.speed * timeDilationFactor;
            
            if (enemy.aiState === 'chase') {
                // Move towards player
                if (enemy.type === 'mover' && dist > 2) {
                    enemy.x += (dx / dist) * moveSpeed * dt;
                    enemy.z += (dz / dist) * moveSpeed * dt;
                }
                
                // Shoot
                if (now > enemy.nextShoot) {
                    enemy.nextShoot = now + 1.5 * (1 / timeDilationFactor); // Shoot every 1.5s
                    projectiles.push({
                        x: enemy.x, y: enemy.y + 1, z: enemy.z,
                        vx: (dx / dist) * 15, vy: (edy / dist) * 15, vz: (dz / dist) * 15,
                        active: true, owner: 'enemy'
                    });
                }
            } else if (enemy.aiState === 'search') {
                // Move towards last known
                if (enemy.type === 'mover') {
                    let ldx = enemy.lastKnownX - enemy.x;
                    let ldz = enemy.lastKnownZ - enemy.z;
                    let ldist = Math.sqrt(ldx*ldx + ldz*ldz);
                    
                    if (ldist > 0.5) {
                        enemy.x += (ldx / ldist) * moveSpeed * dt;
                        enemy.z += (ldz / ldist) * moveSpeed * dt;
                    } else {
                        enemy.aiState = 'idle';
                    }
                } else {
                    enemy.aiState = 'idle';
                }
            }
        }
        
        // Projectiles
        for(let p of projectiles) {
            if (!p.active) continue;
            
            let timeScale = (p.owner === 'enemy') ? timeDilationFactor : 1.0;
            
            // Raycast ahead for accurate collision and wall-breaking
            let dir = new THREE.Vector3(p.vx, p.vy, p.vz);
            let speed = dir.length() * dt * timeScale;
            dir.normalize();
            
            physicsRay.set(new THREE.Vector3(p.x, p.y, p.z), dir);
            let hits = physicsRay.intersectObjects(engine.collisionMeshes, true);
            
            if (hits.length > 0 && hits[0].distance <= speed) {
                p.active = false; // Hit a wall
                
                // Breakable logic
                let obj = hits[0].object;
                if (obj.userData && obj.userData.hp !== undefined) {
                    obj.userData.hp -= p.damage;
                    if (obj.userData.hp <= 0) {
                        engine.scene.remove(obj);
                        engine.collisionMeshes = engine.collisionMeshes.filter(m => m !== obj);
                    }
                }
                continue;
            }
            
            p.x += p.vx * dt * timeScale;
            p.y += p.vy * dt * timeScale;
            p.z += p.vz * dt * timeScale;
            
            if (p.owner === 'enemy') {
                // Check collision with player
                let pdx = p.x - player.x;
                let pdy = p.y - (player.y + player.eyeHeight/2);
                let pdz = p.z - player.z;
                if (Math.sqrt(pdx*pdx + pdy*pdy + pdz*pdz) < player.radius + 0.5) {
                    let damage = 10;
                    player.health -= damage;
                    if (powerups.healthUp.active) {
                        powerups.healthUp.damageTakenDuring += damage; // Record for reflection
                    }
                    p.active = false;
                    
                    // Red flash for taking damage
                    document.getElementById('flash-overlay').style.backgroundColor = 'rgba(255, 0, 0, 0.4)';
                    flashTimer = 0.1;
                }
            } else if (p.owner === 'player') {
                // Check collision with enemies
                for(let enemy of enemies) {
                    if (enemy.hp <= 0) continue;
                    let edx = p.x - enemy.x;
                    let edy = p.y - (enemy.y + 1); // Center of cylinder
                    let edz = p.z - enemy.z;
                    if (Math.sqrt(edx*edx + edz*edz) <= 0.5 && Math.abs(edy) <= 1.0) {
                        enemy.hp -= p.damage;
                        if (enemy.hp < 0) enemy.hp = 0;
                        p.active = false;
                        break;
                    }
                }
            }
            
            // Cleanup out of bounds
            if (p.x < -100 || p.x > 100 || p.z < -100 || p.z > 100) p.active = false;
        }
        projectiles = projectiles.filter(p => p.active);
        
        // Render normal shoot flash (if didn't just take damage)
        const flashOverlay = document.getElementById('flash-overlay');
        if (flashTimer > 0) {
            flashTimer -= dt;
            if (flashOverlay.style.backgroundColor !== 'rgba(255, 0, 0, 0.4)') {
                flashOverlay.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
            }
        } else {
            flashOverlay.style.backgroundColor = 'transparent';
        }
    }

    // Always update HUD and Render
    updateHUD(now);
    engine.render(player, enemies, projectiles);

    requestAnimationFrame(gameLoop);
}

// Start Loop
requestAnimationFrame(gameLoop);
