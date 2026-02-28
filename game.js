/**
 * Gravity Flip Runner
 * Main Game Logic — Enhanced Edition
 * New features: Energy bar, Double-flip boost, Shield, Particle trail, Screen shake,
 * Gravity flip flash, Combo multiplier, Timed levels, Star rating, Homing drones.
 */
import { LEVELS, Level } from './levels.js';

// --- Constants ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const BASE_GRAVITY = 0.6;
const BASE_JUMP = 12;
const BASE_SPEED = 5;
const MAX_FALL_SPEED = 15;
const MAX_ENERGY = 100;
const ENERGY_DRAIN = 35;       // energy cost per flip
const ENERGY_REGEN_GROUND = 2; // regen per frame on ground
const ENERGY_REGEN_AIR = 0.4;  // regen per frame in air
const DOUBLE_FLIP_WINDOW = 250; // ms to detect double-tap G

function getLevelConstants(levelNum) {
    const tier = Math.ceil(levelNum / 5);
    const scale = 1 + (tier - 1) * 0.12;
    return {
        GRAVITY_FORCE: BASE_GRAVITY * scale,
        JUMP_FORCE: BASE_JUMP * scale,
        SPEED: BASE_SPEED * scale,
    };
}

// --- DOM ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-value');
const levelDisplay = document.getElementById('level-value');
const highscoreDisplay = document.getElementById('highscore-value');
const finalScoreDisplay = document.getElementById('final-score');
const gameOverHSDisplay = document.getElementById('game-over-highscore');
const levelScoreDisplay = document.getElementById('level-score');
const totalScoreDisplay = document.getElementById('total-score');
const levelGrid = document.getElementById('level-grid');
const energyBarFill = document.getElementById('energy-bar-fill');
const timerDisplay = document.getElementById('timer-display');
const timerValue = document.getElementById('timer-value');
const shieldDisplay = document.getElementById('shield-display');
const comboDisplay = document.getElementById('combo-display');
const comboMult = document.getElementById('combo-mult');
const star1 = document.getElementById('star1');
const star2 = document.getElementById('star2');
const star3 = document.getElementById('star3');
const starReason = document.getElementById('star-reason');

// Screens
const startScreen = document.getElementById('start-screen');
const levelSelectScreen = document.getElementById('level-select-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const levelCompleteScreen = document.getElementById('level-complete-screen');
const victoryScreen = document.getElementById('victory-screen');
const gameContainer = document.getElementById('game-container');

// Buttons
document.getElementById('start-btn').addEventListener('click', () => startGame(1));
document.getElementById('level-select-btn').addEventListener('click', showLevelSelect);
document.getElementById('back-to-menu-btn').addEventListener('click', showStartScreen);
document.getElementById('restart-btn').addEventListener('click', restartLevel);
document.getElementById('next-level-btn').addEventListener('click', nextLevel);
document.getElementById('play-again-btn').addEventListener('click', resetGame);
document.getElementById('menu-btn').addEventListener('click', resetGame);

const fullscreenBtn = document.getElementById('fullscreen-btn');
if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.log(err));
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    });
}

// --- Game State ---
let gameState = 'MENU';
let score = 0;
let levelStartScore = 0;
let currentLevelIndex = 0;
let animationFrameId;
let currentLevel = null;
let levelConsts = getLevelConstants(1);

// Timed level state
let levelTimer = 0;       // frames elapsed
let levelTimeLimit = 0;   // 0 = no limit

// Star rating state
let orbsCollectedThisLevel = 0;
let totalOrbsThisLevel = 0;

// Score multiplier / combo
let comboCount = 0;       // consecutive orbs collected
let comboMultiplier = 1;
let comboFadeTimer = 0;   // frames until combo resets

// Screen shake
let shakeIntensity = 0;
let shakeDecay = 0.85;

// Flash effect
let flashAlpha = 0;
let flashColor = '#ffffff';

// Particles pool
let particles = [];

let savedData = JSON.parse(localStorage.getItem('gravityFlipData')) || {
    unlockedLevel: 1,
    highScore: 0,
    totalScore: 0,
    stars: {}           // { "levelNum": 0-3 }
};

// --- Input ---
const keys = {
    ArrowLeft: false, ArrowRight: false,
    Space: false, KeyA: false, KeyD: false, KeyG: false
};

window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    if (e.code === 'ArrowLeft') keys.KeyA = true;
    if (e.code === 'ArrowRight') keys.KeyD = true;
    if (e.code === 'KeyA') keys.KeyA = true;
    if (e.code === 'KeyD') keys.KeyD = true;
    if (e.code === 'Space' && !keys.Space && gameState === 'PLAYING') { player.jump(); }
    if (e.code === 'Space') keys.Space = true;
    if (e.code === 'KeyG' && !keys.KeyG && gameState === 'PLAYING') { player.handleFlipKey(); }
    if (e.code === 'KeyG') keys.KeyG = true;
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft') keys.KeyA = false;
    if (e.code === 'ArrowRight') keys.KeyD = false;
    if (e.code === 'KeyA') keys.KeyA = false;
    if (e.code === 'KeyD') keys.KeyD = false;
    if (e.code === 'Space') keys.Space = false;
    if (e.code === 'KeyG') keys.KeyG = false;
});

// --- Dynamic Canvas Scaling ---
function resizeGame() {
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    const scale = Math.min(ww / CANVAS_WIDTH, wh / CANVAS_HEIGHT);
    gameContainer.style.transform = `scale(${scale})`;
    gameContainer.style.transformOrigin = 'center center';
}
window.addEventListener('resize', resizeGame);
resizeGame();

// --- Touch Controls for Mobile ---
const mobileControls = document.getElementById('mobile-controls');
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches;
if (isTouchDevice || window.innerWidth <= 800) {
    if (mobileControls) mobileControls.classList.remove('hidden');
}

function bindTouch(id, keyField) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys[keyField] = true;
        if (keyField === 'Space' && gameState === 'PLAYING') player.jump();
        if (keyField === 'KeyG' && gameState === 'PLAYING') player.handleFlipKey();
    });
    btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys[keyField] = false;
    });
}
bindTouch('btn-left', 'KeyA');
bindTouch('btn-right', 'KeyD');
bindTouch('btn-jump', 'Space');
bindTouch('btn-flip', 'KeyG');

// --- Sound Manager ---
class SoundManager {
    constructor() {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
    }
    playTone(freq, type, duration, vol = 0.1) {
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
    jump() { this.playTone(400, 'square', 0.1); }
    flip() { this.playTone(150, 'sawtooth', 0.3); }
    doubleFlip() {
        this.playTone(200, 'sawtooth', 0.1);
        setTimeout(() => this.playTone(400, 'sawtooth', 0.2), 80);
    }
    collect() { this.playTone(880, 'sine', 0.12); }
    combo(mult) { this.playTone(440 * mult, 'sine', 0.15, 0.13); }
    die() { this.playTone(100, 'sawtooth', 0.5, 0.15); }
    shield() { this.playTone(600, 'sine', 0.2); }
    shieldHit() { this.playTone(200, 'square', 0.3); }
    boost() { this.playTone(500, 'sawtooth', 0.2); }
    bounce() { this.playTone(300, 'sine', 0.15); }
    complete() {
        [523.25, 659.25, 783.99].forEach((f, i) =>
            setTimeout(() => this.playTone(f, 'square', 0.2), i * 110));
    }
}
const sounds = new SoundManager();

// --- Particle System ---
function spawnParticles(x, y, color, count = 8, speed = 3) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const spd = speed * (0.5 + Math.random());
        particles.push({
            x, y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            life: 1,
            decay: 0.03 + Math.random() * 0.04,
            r: 3 + Math.random() * 3,
            color
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.92;
        p.vy *= 0.92;
        p.life -= p.decay;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles() {
    for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// --- Player Class ---
class Player {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.width = 30; this.height = 50;
        this.vx = 0; this.vy = 0;
        this.isGrounded = false;
        this.gravityInverted = false;
        this.color = '#00f3ff';
        this.rotation = 0;
        this.dead = false;
        this.attachedPlatform = null;

        // Energy bar (replaces cooldown timer)
        this.energy = MAX_ENERGY;
        this.lastFlipTime = 0;
        this.lastFlipKeyTime = 0; // for double-tap detection

        // Shield
        this.hasShield = false;
        this.shieldCracked = false;

        // Trail
        this.trail = [];
    }

    // Called on every G keypress
    handleFlipKey() {
        const now = Date.now();
        const timeSinceLast = now - this.lastFlipKeyTime;
        this.lastFlipKeyTime = now;

        // Double-flip: second tap within window → rocket boost
        if (timeSinceLast < DOUBLE_FLIP_WINDOW && timeSinceLast > 50) {
            this._doDoubleFlip();
        } else {
            this._doFlip();
        }
    }

    _doFlip() {
        if (this.energy < ENERGY_DRAIN) return; // not enough energy
        this.energy = Math.max(0, this.energy - ENERGY_DRAIN);
        this.gravityInverted = !this.gravityInverted;
        this.isGrounded = false;
        this.attachedPlatform = null;
        sounds.flip();
        // visual flash
        flashColor = this.gravityInverted ? '#ff00ff' : '#00f3ff';
        flashAlpha = 0.25;
        spawnParticles(this.x + this.width / 2, this.y + this.height / 2, flashColor, 12, 4);
    }

    _doDoubleFlip() {
        if (this.energy < ENERGY_DRAIN * 0.5) return;
        this.energy = Math.max(0, this.energy - ENERGY_DRAIN * 0.5);
        // Rocket launch in current gravity dir
        this.vy = this.gravityInverted ? 18 : -18;
        this.vx += this.gravityInverted ? 0 : 0; // pure vertical boost
        sounds.doubleFlip();
        flashColor = '#ffff00';
        flashAlpha = 0.35;
        shakeIntensity = 6;
        spawnParticles(this.x + this.width / 2, this.y + this.height / 2, '#ffff00', 20, 6);
    }

    update(level) {
        if (this.dead) return;

        // Regen energy
        if (this.isGrounded) this.energy = Math.min(MAX_ENERGY, this.energy + ENERGY_REGEN_GROUND);
        else this.energy = Math.min(MAX_ENERGY, this.energy + ENERGY_REGEN_AIR);

        // Wind zones
        for (const z of level.windZones || []) {
            if (this._col(this, z)) { this.vx += z.fx; this.vy += z.fy; }
        }

        // Gravity zone override
        let gravOverride = null;
        for (const z of level.gravityZones || []) {
            if (this._col(this, z)) { gravOverride = z.dir; break; }
        }

        // Horizontal move
        if (keys.KeyA) this.vx = -levelConsts.SPEED;
        else if (keys.KeyD) this.vx = levelConsts.SPEED;
        else this.vx *= 0.85;

        // Moving platform carry
        if (this.attachedPlatform && this.attachedPlatform.axis === 'x') {
            this.x += this.attachedPlatform.speed;
        }
        this.x += this.vx;
        this.checkHorizontalCollisions(level);

        // Gravity
        const gravDir = gravOverride !== null ? gravOverride
            : this.gravityInverted ? -1 : 1;
        this.vy += levelConsts.GRAVITY_FORCE * gravDir;
        if (Math.abs(this.vy) > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED * Math.sign(this.vy);
        this.y += this.vy;

        this.isGrounded = false;
        this.attachedPlatform = null;
        this.checkVerticalCollisions(level);

        if (this.y > CANVAS_HEIGHT + 100 || this.y < -100) { this.die(); return; }

        this.checkHazards(level);
        this.checkCollectibles(level);
        this.checkTeleporters(level);
        this.checkSpeedPads(level);
        this.checkBouncePads(level);
        this.checkGravityMines(level);
        this.checkPortal(level);

        // Rotation animation
        const targetRotation = this.gravityInverted ? 180 : 0;
        this.rotation += (targetRotation - this.rotation) * 0.2;

        // Trail
        this.trail.push({ x: this.x + this.width / 2, y: this.y + this.height / 2, life: 1 });
        if (this.trail.length > 18) this.trail.shift();
        this.trail.forEach(t => t.life -= 0.07);
    }

    checkHorizontalCollisions(level) {
        [...level.platforms,
        ...level.movingPlatforms,
        ...(level.crushers || []).map(c => ({ x: c.x, y: c.y, w: c.w, h: c.h })),
        ...(level.disappearingPlatforms || []).filter(p => p.state !== 'gone')
        ].forEach(p => this.resolveHorizontal(p));
    }

    resolveHorizontal(p) {
        if (this._col(this, p)) {
            if (this.vx > 0) this.x = p.x - this.width;
            else if (this.vx < 0) this.x = p.x + p.w;
            this.vx = 0;
        }
    }

    checkVerticalCollisions(level) {
        [...level.platforms,
        ...level.movingPlatforms
        ].forEach(p => this.resolveVertical(p, true));

        (level.crushers || []).forEach(c =>
            this.resolveVertical({ x: c.x, y: c.y, w: c.w, h: c.h, axis: null }, true));

        (level.disappearingPlatforms || []).forEach(p => {
            if (p.state !== 'gone') {
                const before = this.isGrounded;
                this.resolveVertical(p, true);
                if (!before && this.isGrounded) p._touched = true;
            }
        });

        // One-way platforms
        if (!this.gravityInverted) {
            for (const p of level.oneWayPlatforms || []) {
                if (this.vy > 0 && this._col(this, p) && this.y + this.height - this.vy <= p.y + 2) {
                    this.y = p.y - this.height; this.vy = 0; this.isGrounded = true;
                }
            }
        } else {
            for (const p of level.oneWayPlatforms || []) {
                if (this.vy < 0 && this._col(this, p) && this.y - this.vy >= p.y + p.h - 2) {
                    this.y = p.y + p.h; this.vy = 0; this.isGrounded = true;
                }
            }
        }
    }

    resolveVertical(p, attach = false) {
        if (this._col(this, p)) {
            if (this.vy > 0) {
                this.y = p.y - this.height; this.vy = 0;
                if (!this.gravityInverted) {
                    this.isGrounded = true;
                    if (attach && p.axis) this.attachedPlatform = p;
                }
            } else if (this.vy < 0) {
                this.y = p.y + p.h; this.vy = 0;
                if (this.gravityInverted) {
                    this.isGrounded = true;
                    if (attach && p.axis) this.attachedPlatform = p;
                }
            }
        }
    }

    checkHazards(level) {
        for (const h of level.hazards) {
            if (this._col(this, h)) { this.takeDamage(); return; }
        }
        for (const l of level.lasers) {
            if (l.active && this._col(this, l)) { this.takeDamage(); return; }
        }
        for (const s of level.sawBlades || []) {
            const px = this.x + this.width / 2, py = this.y + this.height / 2;
            if (Math.hypot(s.x - px, s.y - py) < s.r + 10) { this.takeDamage(); return; }
        }
        for (const c of level.crushers || []) {
            if (this._col(this, { x: c.x, y: c.y, w: c.w, h: c.h })) { this.takeDamage(); return; }
        }
        for (const d of level.drones || []) {
            if (this._col(this, d)) { this.takeDamage(); return; }
        }
        for (const t of level.turrets || []) {
            for (const p of t.projectiles) {
                if (this._col(this, p)) { this.takeDamage(); return; }
            }
        }
        for (const b of level.barrels || []) {
            if (b.exploding && this._col(this, { x: b.x - b.blastR, y: b.y - b.blastR, w: b.blastR * 2, h: b.blastR * 2 })) {
                this.takeDamage(); return;
            }
        }

        // Level Devil trap checks
        const trapResult = level.checkTraps(this);
        if (trapResult === 'invert') {
            // Invert button trick — flip gravity without energy cost
            this.gravityInverted = !this.gravityInverted;
            this.isGrounded = false;
            flashColor = '#ff00ff';
            flashAlpha = 0.4;
            shakeIntensity = 5;
            spawnParticles(this.x + this.width / 2, this.y + this.height / 2, '#ff00ff', 16, 5);
            showTrickMessage('😈 Gotcha! Gravity flipped — no refund.');
        } else if (trapResult === true) {
            const msg = level._trickKill || '💀 GOTCHA!';
            showTrickMessage(msg);
            setTimeout(() => this.die(), 500);
            // Prevent normal die from being called immediately
            this.dead = true;
            shakeIntensity = 14;
            flashColor = '#ff0000'; flashAlpha = 0.5;
            spawnParticles(this.x + this.width / 2, this.y + this.height / 2, '#ff0055', 30, 7);
            sounds.die();
        }
    }

    takeDamage() {
        if (this.hasShield) {
            if (this.shieldCracked) {
                // shield breaks
                this.hasShield = false;
                this.shieldCracked = false;
                shieldDisplay.classList.add('hidden');
                spawnParticles(this.x + this.width / 2, this.y + this.height / 2, '#00aaff', 20, 5);
                shakeIntensity = 8;
                sounds.shieldHit();
            } else {
                // first hit cracks it
                this.shieldCracked = true;
                shakeIntensity = 4;
                sounds.shieldHit();
                spawnParticles(this.x + this.width / 2, this.y + this.height / 2, '#00aaff', 10, 3);
            }
        } else {
            this.die();
        }
    }

    checkCollectibles(level) {
        for (const c of level.collectibles) {
            if (c.collected) continue;
            if (this.checkCollision(this, c)) {
                c.collected = true;
                orbsCollectedThisLevel++;

                // Handle shield pickup
                if (c.type === 'shield') {
                    this.hasShield = true;
                    this.shieldCracked = false;
                    shieldDisplay.classList.remove('hidden');
                    sounds.shield();
                    spawnParticles(c.x + c.w / 2, c.y + c.h / 2, '#00aaff', 12, 4);
                    continue;
                }

                // Combo system
                comboCount++;
                comboFadeTimer = 180; // 3 seconds to keep combo alive
                if (comboCount >= 5) comboMultiplier = 5;
                else if (comboCount >= 3) comboMultiplier = 3;
                else if (comboCount >= 2) comboMultiplier = 2;
                else comboMultiplier = 1;

                const baseVal = c.type === 'multiplier' ? (level.collectibleValue || 10) * 3
                    : (level.collectibleValue || 10);
                const earned = baseVal * comboMultiplier;
                score += earned;
                updateHUD();
                sounds.collect();
                if (comboMultiplier > 1) sounds.combo(comboMultiplier);

                // Update combo UI
                comboMult.textContent = `x${comboMultiplier}`;
                comboDisplay.classList.remove('hidden');
                // re-trigger pop animation
                comboMult.style.animation = 'none';
                void comboMult.offsetWidth;
                comboMult.style.animation = '';

                spawnParticles(c.x + c.w / 2, c.y + c.h / 2,
                    c.type === 'multiplier' ? '#ff00ff' : '#ccff00', 10, 4);
            }
        }
    }

    checkTeleporters(level) {
        if (level._teleCooldownGlobal > 0) return;
        for (const t of level.teleporters || []) {
            if (t.cooldown > 0) continue;
            if (this._col(this, t)) {
                const partner = level.teleporters.find(o => o.pairId === t.pairId && o.side !== t.side);
                if (!partner) continue;
                this.x = partner.x + partner.w / 2 - this.width / 2;
                this.y = partner.y;
                this.vy = 0;
                spawnParticles(partner.x + 15, partner.y + 20, '#00ffff', 14, 4);
                level._teleCooldownGlobal = 40;
                t.cooldown = 60;
                partner.cooldown = 60;
                return;
            }
        }
    }

    checkSpeedPads(level) {
        for (const p of level.speedPads || []) {
            if (this._col(this, { x: p.x, y: p.y, w: p.w, h: p.h })) {
                if (!p._active) {
                    p._active = true;
                    const boost = levelConsts.SPEED * 1.8;
                    this.vx = this.vx >= 0 ? boost : -boost;
                    sounds.boost();
                    spawnParticles(p.x + p.w / 2, p.y + p.h / 2, '#ff8800', 12, 5);
                    flashColor = '#ff8800';
                    flashAlpha = 0.18;
                }
            } else {
                p._active = false;
            }
        }
    }

    checkBouncePads(level) {
        for (const p of level.bouncePads || []) {
            if (this._col(this, { x: p.x, y: p.y, w: p.w, h: p.h })) {
                if (!p._bounced) {
                    p._bounced = true;
                    // Catapult in the opposite direction of gravity
                    this.vy = this.gravityInverted ? 16 : -16;
                    this.isGrounded = false;
                    sounds.bounce();
                    spawnParticles(p.x + p.w / 2, p.y + p.h / 2, '#00ff88', 14, 5);
                    p._animTimer = 8;
                }
            } else {
                p._bounced = false;
            }
        }
    }

    checkGravityMines(level) {
        for (const m of level.gravityMines || []) {
            if (m.triggered) continue;
            const px = this.x + this.width / 2, py = this.y + this.height / 2;
            if (Math.hypot(m.x - px, m.y - py) < m.r + 15) {
                m.triggered = true;
                m.respawnTimer = 180;
                // Invert gravity without spending energy
                this.gravityInverted = !this.gravityInverted;
                this.isGrounded = false;
                flashColor = '#ff00ff';
                flashAlpha = 0.3;
                shakeIntensity = 5;
                spawnParticles(m.x, m.y, '#ff00ff', 20, 6);
            }
        }
    }

    checkPortal(level) {
        if (this._col(this, level.portal)) triggerLevelComplete();
    }

    _col(a, b) {
        return (a.x < b.x + b.w && a.x + (a.width || a.w || 0) > b.x &&
            a.y < b.y + b.h && a.y + (a.height || a.h || 0) > b.y);
    }

    checkCollision(a, b) { return this._col(a, b); }

    draw() {
        // Trail
        for (let i = 0; i < this.trail.length; i++) {
            const t = this.trail[i];
            const alpha = t.life * 0.6 * (i / this.trail.length);
            if (alpha <= 0) continue;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = this.gravityInverted ? '#ff00ff' : '#00f3ff';
            ctx.shadowBlur = 8;
            ctx.shadowColor = this.gravityInverted ? '#ff00ff' : '#00f3ff';
            const sz = (i / this.trail.length) * 12;
            ctx.beginPath();
            ctx.arc(t.x, t.y, sz, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.rotation * Math.PI / 180);

        // Shield ring
        if (this.hasShield) {
            ctx.save();
            ctx.strokeStyle = this.shieldCracked ? 'rgba(0,100,255,0.5)' : 'rgba(0,180,255,0.9)';
            ctx.lineWidth = this.shieldCracked ? 2 : 3;
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#00aaff';
            ctx.setLineDash(this.shieldCracked ? [4, 4] : []);
            ctx.beginPath();
            ctx.arc(0, 0, 28, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // Body
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        ctx.fillStyle = '#000';
        ctx.fillRect(-5, -15, 20, 10);
        ctx.restore();
    }

    jump() {
        if (this.isGrounded) {
            this.vy = levelConsts.JUMP_FORCE * (this.gravityInverted ? 1 : -1);
            this.isGrounded = false;
            this.attachedPlatform = null;
            sounds.jump();
        }
    }

    die() {
        if (this.dead) return;
        this.dead = true;
        shakeIntensity = 14;
        flashColor = '#ff0000';
        flashAlpha = 0.45;
        spawnParticles(this.x + this.width / 2, this.y + this.height / 2, '#ff0055', 30, 7);
        sounds.die();
        setTimeout(() => triggerGameOver(), 400);
    }
}

let player;

// --- Persistence ---
function loadStorage() {
    const data = localStorage.getItem('gravityFlipData');
    if (data) savedData = JSON.parse(data);
    if (!savedData.stars) savedData.stars = {};
}

function saveStorage() {
    localStorage.setItem('gravityFlipData', JSON.stringify(savedData));
}

// --- Level Init ---
function initLevel(levelNum) {
    if (levelNum > LEVELS.length) { triggerVictory(); return; }
    currentLevelIndex = levelNum - 1;
    const levelData = LEVELS[currentLevelIndex];
    if (!levelData) { console.error('Level not found:', levelNum); return; }

    levelConsts = getLevelConstants(levelNum);
    currentLevel = new Level(levelData, levelNum);
    player = new Player(currentLevel.playerStart.x, currentLevel.playerStart.y);
    particles = [];

    // Timed levels: first timed level at 15, limit shrinks
    const tier = Math.ceil(levelNum / 5);
    if (levelNum >= 15) {
        levelTimeLimit = Math.max(20, 60 - (tier - 3) * 5); // seconds
        timerValue.textContent = levelTimeLimit;
        timerDisplay.classList.remove('hidden');
        timerDisplay.classList.remove('urgent');
    } else {
        levelTimeLimit = 0;
        timerDisplay.classList.add('hidden');
    }
    levelTimer = 0;

    // Orb tracking for stars
    orbsCollectedThisLevel = 0;
    totalOrbsThisLevel = currentLevel.collectibles.filter(c => c.type !== 'shield').length;

    // Reset combo
    comboCount = 0;
    comboMultiplier = 1;
    comboFadeTimer = 0;
    comboDisplay.classList.add('hidden');

    // Shield HUD
    shieldDisplay.classList.add('hidden');

    levelDisplay.innerText = `${levelNum} - ${currentLevel.title}`;
    gameState = 'PLAYING';
    updateHUD();
    gameLoop();
}

// --- Game Loop ---
function update() {
    if (gameState !== 'PLAYING') return;

    // Timer
    if (levelTimeLimit > 0) {
        levelTimer++;
        const secsLeft = Math.ceil(levelTimeLimit - levelTimer / 60);
        timerValue.textContent = Math.max(0, secsLeft);
        if (secsLeft <= 10) timerDisplay.classList.add('urgent');
        if (secsLeft <= 0 && !player.dead) { player.die(); }
    }

    // Combo decay
    if (comboFadeTimer > 0) {
        comboFadeTimer--;
        if (comboFadeTimer === 0) {
            comboCount = 0;
            comboMultiplier = 1;
            comboDisplay.classList.add('hidden');
        }
    }

    // Energy bar UI
    const pct = (player.energy / MAX_ENERGY) * 100;
    energyBarFill.style.width = pct + '%';
    if (player.energy < ENERGY_DRAIN) {
        energyBarFill.style.background = '#ff3300';
    } else {
        energyBarFill.style.background = 'linear-gradient(90deg, #ffee00, #ff8800)';
    }

    // Screen shake
    if (shakeIntensity > 0.5) shakeIntensity *= shakeDecay;
    else shakeIntensity = 0;

    // Flash decay
    if (flashAlpha > 0.01) flashAlpha *= 0.88;
    else flashAlpha = 0;

    currentLevel.update(player);
    player.update(currentLevel);
    updateParticles();
}

function draw() {
    // Apply screen shake
    const sx = shakeIntensity > 0 ? (Math.random() - 0.5) * shakeIntensity * 2 : 0;
    const sy = shakeIntensity > 0 ? (Math.random() - 0.5) * shakeIntensity * 2 : 0;

    ctx.save();
    ctx.translate(sx, sy);

    ctx.clearRect(-10, -10, CANVAS_WIDTH + 20, CANVAS_HEIGHT + 20);
    ctx.fillStyle = '#050510';
    ctx.fillRect(-10, -10, CANVAS_WIDTH + 20, CANVAS_HEIGHT + 20);

    if (currentLevel) currentLevel.draw(ctx);
    drawParticles();
    if (player) player.draw();

    // Gravity flip flash overlay
    if (flashAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = flashAlpha;
        ctx.fillStyle = flashColor;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.restore();
    }

    ctx.restore();
}

function gameLoop() {
    if (gameState === 'PLAYING') {
        update();
        draw();
        animationFrameId = requestAnimationFrame(gameLoop);
    }
}

// --- Screen Management ---
function startGame(levelNum) {
    screensOff();
    loadStorage();
    if (levelNum === 1) score = 0;
    levelStartScore = score;
    updateHUD();
    initLevel(levelNum);
}

function showStartScreen() {
    screensOff();
    gameState = 'MENU';
    startScreen.classList.remove('hidden');
    startScreen.classList.add('active');
    function menuLoop() {
        if (gameState === 'MENU') {
            ctx.fillStyle = '#050510';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            requestAnimationFrame(menuLoop);
        }
    }
    menuLoop();
}

function showLevelSelect() {
    screensOff();
    gameState = 'LEVEL_SELECT';
    levelSelectScreen.classList.remove('hidden');
    levelSelectScreen.classList.add('active');
    loadStorage();
    levelGrid.innerHTML = '';

    for (let i = 1; i <= LEVELS.length; i++) {
        const btn = document.createElement('div');
        btn.classList.add('level-btn');
        const starCount = (savedData.stars || {})[i] || 0;
        const starStr = '★'.repeat(starCount) + '☆'.repeat(3 - starCount);
        btn.innerHTML = `${i}<span class="btn-stars">${starCount > 0 ? starStr : ''}</span>`;
        if (i > savedData.unlockedLevel) {
            btn.classList.add('locked');
        } else {
            btn.addEventListener('click', () => startGame(i));
            if (starCount === 3) btn.classList.add('completed');
        }
        levelGrid.appendChild(btn);
    }
}

function screensOff() {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
}

function triggerGameOver() {
    if (gameState === 'GAME_OVER') return;
    gameState = 'GAME_OVER';
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (score > (savedData.highScore || 0)) { savedData.highScore = score; saveStorage(); }
    finalScoreDisplay.innerText = score;
    gameOverHSDisplay.innerText = savedData.highScore;
    score = 0; levelStartScore = 0;
    gameOverScreen.classList.remove('hidden');
    gameOverScreen.classList.add('active');
}

function triggerLevelComplete() {
    if (gameState !== 'PLAYING') return;
    gameState = 'LEVEL_COMPLETE';
    cancelAnimationFrame(animationFrameId);

    const levelNum = currentLevelIndex + 1;
    const bonus = 50 + currentLevelIndex * 5;
    score += bonus;
    levelStartScore = score;
    savedData.totalScore = score;
    if (score > savedData.highScore) savedData.highScore = score;
    if (currentLevelIndex + 2 > savedData.unlockedLevel) savedData.unlockedLevel = currentLevelIndex + 2;

    // Calculate stars
    const timeTaken = levelTimer / 60; // seconds
    const allOrbs = totalOrbsThisLevel > 0 && orbsCollectedThisLevel >= totalOrbsThisLevel;
    const fastTime = levelTimeLimit > 0
        ? timeTaken <= levelTimeLimit * 0.6
        : timeTaken <= 30 + levelNum * 2;
    const okayTime = levelTimeLimit > 0
        ? timeTaken <= levelTimeLimit * 0.85
        : timeTaken <= 60 + levelNum * 3;

    let stars = 1;
    if (allOrbs && fastTime) stars = 3;
    else if (allOrbs || fastTime) stars = 2;

    // Store best stars
    if (!savedData.stars) savedData.stars = {};
    if ((savedData.stars[levelNum] || 0) < stars) savedData.stars[levelNum] = stars;
    saveStorage();

    // UI stars
    const starEls = [star1, star2, star3];
    starEls.forEach(s => s.classList.remove('earned'));
    setTimeout(() => {
        for (let i = 0; i < stars; i++) {
            setTimeout(() => starEls[i].classList.add('earned'), i * 200);
        }
    }, 100);

    let reason = stars === 3 ? 'All orbs + fast clear!' : stars === 2 ? (allOrbs ? 'All orbs collected!' : 'Quick clear!') : 'Reached the exit!';
    starReason.textContent = reason;

    levelScoreDisplay.innerText = score;
    levelCompleteScreen.classList.remove('hidden');
    levelCompleteScreen.classList.add('active');
    sounds.complete();
    spawnParticles(400, 300, '#ccff00', 40, 8);
}

function triggerVictory() {
    if (gameState === 'VICTORY') return;
    gameState = 'VICTORY';
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    totalScoreDisplay.innerText = score;
    victoryScreen.classList.remove('hidden');
    victoryScreen.classList.add('active');
    sounds.complete();
}

function restartLevel() {
    score = levelStartScore;
    screensOff();
    initLevel(currentLevelIndex + 1);
}

function nextLevel() {
    screensOff();
    initLevel(currentLevelIndex + 2);
}

function resetGame() {
    const prevHigh = savedData.highScore || 0;
    const prevStars = savedData.stars || {};
    localStorage.removeItem('gravityFlipData');
    savedData = { unlockedLevel: 1, totalScore: 0, highScore: prevHigh, stars: prevStars };
    score = 0; levelStartScore = 0;
    saveStorage();
    showStartScreen();
}

function updateHUD() {
    scoreDisplay.innerText = score;
    highscoreDisplay.innerText = savedData.highScore || 0;
}

// ─── Level Devil Trick Message ────────────────────────────────────────────────
let _trickMsgTimeout = null;
function showTrickMessage(text) {
    const el = document.getElementById('trick-message');
    if (!el) return;
    el.textContent = text;
    el.classList.add('visible');
    if (_trickMsgTimeout) clearTimeout(_trickMsgTimeout);
    _trickMsgTimeout = setTimeout(() => {
        el.classList.remove('visible');
    }, 1800);
}

showStartScreen();
