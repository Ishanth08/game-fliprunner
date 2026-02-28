/**
 * Gravity Flip Runner - levels.js  (Enhanced Edition)
 * New elements: speedPads, bouncePads, gravityMines, barrels,
 *               homing drones, shield/multiplier pickups, moving collectibles.
 */

// ─── Seeded RNG ───────────────────────────────────────────────────────────────
function makeRng(seed) {
    let s = seed;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// ─── Level Generator ─────────────────────────────────────────────────────────
export class LevelGenerator {
    constructor() { this.totalLevels = 100; }

    generateAllLevels() {
        const lvls = [];
        for (let i = 1; i <= this.totalLevels; i++) {
            if (i === 50 || i === 100) {
                lvls.push(this.generateBossLevel(i));
            } else {
                lvls.push(this.generateLevel(i));
            }
        }
        return lvls;
    }

    generateLevel(num) {
        const rng = makeRng(num * 137);
        const tier = Math.ceil(num / 5);

        const SECTOR_THEMES = [
            'none', // 0
            'basics', // 1: 1-5
            'moving_plats', // 2: 6-10
            'speed_pads', // 3: 11-15
            'bounce_pads', // 4: 16-20
            'lasers', // 5: 21-25
            'disappearing', // 6: 26-30
            'saw_blades', // 7: 31-35
            'wind', // 8: 36-40
            'gravity_zones', // 9: 41-45
            'one_way', // 10: 46-50
            'teleporters', // 11: 51-55
            'crushers', // 12: 56-60
            'drones', // 13: 61-65
            'mines', // 14: 66-70
            'barrels', // 15: 71-75
            'turrets', // 16: 76-80
            'traps', // 17: 81-85
            'wind_gravity_drones', // 18: 86-90
            'lasers_teleporters', // 19: 91-95
            'all' // 20: 96-100
        ];
        const theme = SECTOR_THEMES[tier] || 'all';

        const lvl = {
            id: num,
            title: `Sector ${tier}-${(num - 1) % 5 + 1}`,
            playerStart: { x: 60, y: 500 },
            portal: { x: 730, y: 500, w: 40, h: 60 },
            platforms: [], movingPlatforms: [], hazards: [],
            lasers: [], disappearingPlatforms: [], sawBlades: [],
            windZones: [], gravityZones: [], oneWayPlatforms: [],
            teleporters: [], crushers: [], drones: [], turrets: [],
            collectibles: [], speedPads: [], bouncePads: [],
            gravityMines: [], barrels: [],
            traps: [],
        };

        // ── Floor & Ceiling ──────────────────────────────────────────────────
        this._plat(lvl, 0, 580, 800, 20);  // floor
        this._plat(lvl, 0, 0, 800, 20);   // ceiling

        // ── Structured Layout Grid ───────────────────────────────────────────
        // Canvas: 800×600. Play area: x 80–720, y 40–560.
        //
        // We divide the horizontal space into 4 columns (each ~160px wide)
        // and the vertical space into 4 rows.
        //
        //  Col:   0          1          2          3
        //  x:    100        260        420        580
        //
        //  Row y values (platform tops):
        //    row0 = 460  (near floor — low shelf)
        //    row1 = 340  (lower-mid)
        //    row2 = 220  (upper-mid)
        //    row3 = 110  (near ceiling — high shelf)
        //
        // Each "slot" = one platform or obstacle position.
        // We pick a deterministic subset of slots per level number so layouts
        // vary predictably rather than randomly scattering.

        const COLS = [100, 260, 420, 580];
        const ROWS = [460, 340, 220, 110];
        const PLAT_W = 120 + Math.floor(rng() * 40); // 120–160 wide (same per level)

        // Platform slots: 4×4 grid but we exclude col 0 row 0 (player start area)
        // and col 3 row 0 (portal area). Pick ~3 + tier/2 slots.
        const allSlots = [];
        for (let c = 0; c < 4; c++)
            for (let r = 0; r < 4; r++)
                if (!(c === 0 && r === 0) && !(c === 3 && r === 0)) // exclude start & portal rows
                    allSlots.push({ c, r });

        // Shuffle with rng for level variety, then pick a count
        for (let i = allSlots.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [allSlots[i], allSlots[j]] = [allSlots[j], allSlots[i]];
        }
        const platCount = 4 + Math.min(Math.floor(tier / 2), 4);
        const usedSlots = allSlots.slice(0, platCount);

        // Place static platforms at chosen slots (consistent width per col)
        for (const { c, r } of usedSlots) {
            const px = COLS[c];
            const py = ROWS[r];
            this._plat(lvl, px, py, PLAT_W, 20);
        }

        // Wall obstacles — randomly placed, checking for overlaps to prevent stacking
        if (num >= 2) {
            const numWalls = Math.min(1 + Math.floor(tier / 3), 2);
            for (let i = 0; i < numWalls; i++) {
                const wh = 80 + Math.floor(rng() * 80);
                const wy = 120 + Math.floor(rng() * 260);
                const wx = 150 + Math.floor(rng() * 450);
                const wallObj = { x: wx, y: wy, w: 20, h: wh, type: 'wall' };
                if (!this._overlaps(wallObj, lvl.platforms, 40, 20)) {
                    lvl.platforms.push(wallObj);
                }
            }
        }

        // ── Moving Platforms (evenly spaced across X axis) ───────────────────
        {
            const cnt = Math.min(2 + Math.floor(num / 3), 6);
            // Evenly space moving platforms across horizontal range 150–650
            const spacing = Math.floor(500 / (cnt + 1));
            for (let i = 0; i < cnt; i++) {
                const x = 150 + spacing * (i + 1);
                // Alternate between two mid-heights to create a zigzag path
                const y = (i % 2 === 0) ? 300 : 200;
                const w = 80 + Math.floor(rng() * 60);
                const axis = (tier >= 3 && i % 3 === 0) ? 'y' : 'x';
                const range = 60 + Math.floor(rng() * (40 + tier * 10));
                const spd = 2.0 + rng() * (0.5 + tier * 0.4);

                const mp = { x, y, w, h: 20, startX: x, startY: y, range, axis, speed: spd };
                const checkRect = {
                    x: axis === 'x' ? x - range : x,
                    y: axis === 'y' ? y - range : y,
                    w: axis === 'x' ? w + range * 2 : w,
                    h: axis === 'y' ? 20 + range * 2 : 20
                };
                if (!this._overlaps(checkRect, lvl.platforms, 20, 20)) {
                    lvl.movingPlatforms.push(mp);
                }
            }
        }

        // ── Platform Role Table ──────────────────────────────────────────────
        // Each eligible static platform gets exactly ONE top-surface role and
        // ONE bottom-surface role. This guarantees zero stacking.
        //
        //  Top roles:  'spike' | 'speed' | 'bounce' | 'saw' | 'barrel' | 'turret' | 'empty'
        //  Bot roles:  'spike_inv' | 'empty'

        const eligible = lvl.platforms.filter(p =>
            p.type === 'static' && p.x > 140 && p.x < 620 && p.w >= 50
        );

        // Shuffle eligible platforms (seeded, deterministic per level)
        for (let i = eligible.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
        }

        // Build ordered top-role queue based on what is unlocked at this level
        const topRoles = [];

        const spikeTopCount = Math.min(1 + Math.floor(tier / 2), 3);
        for (let i = 0; i < spikeTopCount; i++) topRoles.push('spike');

        if (theme === 'speed_pads' || theme === 'all') {
            const cnt = Math.min(Math.floor((num - 2) / 4) + 1, 2);
            for (let i = 0; i < cnt; i++) topRoles.push('speed');
        }
        if (theme === 'bounce_pads' || theme === 'all') {
            const cnt = Math.min(Math.floor((num - 3) / 4) + 1, 2);
            for (let i = 0; i < cnt; i++) topRoles.push('bounce');
        }
        if (theme === 'saw_blades' || theme === 'all') {
            const cnt = Math.min(Math.floor((num - 8) / 2) + 1, 3);
            for (let i = 0; i < cnt; i++) topRoles.push('saw');
        }
        if (theme === 'barrels' || theme === 'all') {
            const cnt = Math.min(Math.floor((num - 24) / 3) + 1, 2);
            for (let i = 0; i < cnt; i++) topRoles.push('barrel');
        }
        if (theme === 'turrets' || theme === 'all') {
            const cnt = Math.min(Math.floor((num - 30) / 2) + 1, 3);
            for (let i = 0; i < cnt; i++) topRoles.push('turret');
        }
        while (topRoles.length < eligible.length) topRoles.push('empty');

        // Bottom role queue (inverted spikes under platforms)
        const botRoles = [];
        const spikeBotCount = Math.min(Math.floor(tier / 2), 3);
        for (let i = 0; i < spikeBotCount; i++) botRoles.push('spike_inv');
        while (botRoles.length < eligible.length) botRoles.push('empty');

        // Assign one role per platform — guaranteed no two things on the same surface
        const _fireInterval = Math.max(60, 150 - tier * 8);
        for (let i = 0; i < eligible.length; i++) {
            const p = eligible[i];
            const topRole = topRoles[i] || 'empty';
            const botRole = botRoles[i] || 'empty';
            const sw = Math.min(40 + tier * 4, p.w - 16);
            const cx = p.x + Math.floor((p.w - sw) / 2);

            // Top surface
            if (topRole === 'spike') {
                lvl.hazards.push({ x: cx, y: p.y - 15, w: sw, h: 15, type: 'spikes' });

            } else if (topRole === 'speed') {
                const pw = Math.min(40, p.w - 10);
                lvl.speedPads.push({ x: p.x + Math.floor((p.w - pw) / 2), y: p.y - 12, w: pw, h: 12, _active: false });

            } else if (topRole === 'bounce') {
                const pw = Math.min(45, p.w - 10);
                lvl.bouncePads.push({ x: p.x + Math.floor((p.w - pw) / 2), y: p.y - 14, w: pw, h: 14, _bounced: false, _animTimer: 0 });

            } else if (topRole === 'saw') {
                const sx = p.x + Math.floor(p.w / 2);
                const range = Math.max(10, Math.floor(p.w / 2) - 16);
                lvl.sawBlades.push({ x: sx, y: p.y - 16, r: 14, startX: sx, range, speed: 2.0 + rng() * tier * 0.6, angle: 0, axis: 'x' });

            } else if (topRole === 'barrel') {
                const bx = p.x + Math.floor((p.w - 26) / 2);
                lvl.barrels.push({ x: bx, y: p.y - 26, w: 26, h: 26, exploding: false, blastTimer: 0, blastDuration: 30, blastR: 0, maxBlastR: 60, respawnTimer: 0, respawnTime: 300 });

            } else if (topRole === 'turret') {
                const tx = p.x + Math.floor(p.w / 2) - 10;
                lvl.turrets.push({ x: tx, y: p.y - 20, w: 20, h: 20, fireTimer: i * 18, fireInterval: _fireInterval, projectiles: [] });
            }

            // Bottom surface
            if (botRole === 'spike_inv') {
                lvl.hazards.push({ x: cx, y: p.y + p.h, w: sw, h: 15, type: 'spikes_inverted' });
            }
        }

        // ── Floor & ceiling spikes (evenly spaced, separate from platform spikes) ─
        {
            const fsc = Math.min(2 + tier * 2, 12);
            const spacing = Math.floor(480 / (fsc + 1));
            for (let i = 0; i < fsc; i++) {
                const sx = 140 + spacing * (i + 1);
                const onFloor = i % 2 === 0;
                const sw = 28 + tier * 3;
                const candidate = { x: sx, y: onFloor ? 565 : 20, w: sw, h: 15 };
                if (!this._overlaps(candidate, lvl.hazards, 8, 0))
                    lvl.hazards.push({ ...candidate, type: onFloor ? 'spikes_inverted' : 'spikes' });
            }
        }



        // ── Lasers (alternating h/v, fixed lanes) ────────────────────────────
        if (theme === 'lasers' || theme === 'lasers_teleporters' || theme === 'all') {
            const cnt = Math.min(Math.floor((num - 4) / 2), 5);
            const vertX = [200, 380, 560], horizY = [150, 300, 450];
            const interval = Math.max(20, 130 - tier * 12);
            for (let i = 0; i < cnt; i++) {
                if (i % 2 === 0) {
                    const x = vertX[Math.floor(i / 2) % vertX.length];
                    lvl.lasers.push({ x, y: 20, w: 12, h: 560, active: true, timer: Math.floor(i * interval / cnt), interval, isVertical: true, sweeps: num >= 20 && i === 0, sweepDir: 1, sweepOffset: 0, sweepRange: 200 });
                } else {
                    const y = horizY[Math.floor(i / 2) % horizY.length];
                    lvl.lasers.push({ x: 20, y, w: 760, h: 12, active: true, timer: Math.floor(i * interval / cnt), interval, isVertical: false, sweeps: false, sweepDir: 1, sweepOffset: 0, sweepRange: 0 });
                }
            }
        }

        // ── Disappearing Platforms (4 named slots) ────────────────────────────
        if (theme === 'disappearing' || theme === 'all') {
            const cnt = Math.min(Math.floor((num - 6) / 2) + 1, 4);
            const dpSlots = [{ x: 160, y: 390 }, { x: 400, y: 270 }, { x: 300, y: 170 }, { x: 520, y: 390 }];
            for (let i = 0; i < Math.min(cnt, dpSlots.length); i++) {
                const { x, y } = dpSlots[i];
                const w = 100 + Math.floor(rng() * 60);
                if (!this._overlaps({ x, y, w, h: 20 }, lvl.platforms, 40, 40))
                    lvl.disappearingPlatforms.push({ x, y, w, h: 20, alpha: 1, state: 'solid', timer: 0, solidTime: 120, fadeTime: 60, respawnTime: 90 });
            }
        }

        // ── Wind Zones (4 corner slots) ───────────────────────────────────────
        if (theme === 'wind' || theme === 'wind_gravity_drones' || theme === 'all') {
            const cnt = Math.min(Math.floor((num - 10) / 2) + 1, 4);
            const windSlots = [{ x: 80, y: 60 }, { x: 560, y: 60 }, { x: 80, y: 400 }, { x: 560, y: 400 }];
            for (let i = 0; i < Math.min(cnt, windSlots.length); i++) {
                const { x, y } = windSlots[i];
                lvl.windZones.push({ x, y, w: 120, h: 120, fx: (i % 2 === 0 ? 1 : -1) * 0.15 * tier, fy: (i < 2 ? 0.1 : -0.1) * tier });
            }
        }

        // ── Gravity Zones (mid-area strips) ──────────────────────────────────
        if (theme === 'gravity_zones' || theme === 'wind_gravity_drones' || theme === 'all') {
            const cnt = Math.min(Math.floor((num - 12) / 2) + 1, 3);
            const gzSlots = [{ x: 200, y: 150, w: 120, h: 100 }, { x: 450, y: 350, w: 120, h: 100 }, { x: 310, y: 250, w: 120, h: 100 }];
            for (let i = 0; i < Math.min(cnt, gzSlots.length); i++)
                lvl.gravityZones.push({ ...gzSlots[i], dir: i % 2 === 0 ? 1 : -1 });
        }

        // ── One-Way Platforms (staggered zigzag) ─────────────────────────────
        if (theme === 'one_way' || theme === 'all') {
            const cnt = Math.min(Math.floor((num - 14) / 2) + 1, 4);
            const owpXs = [110, 270, 430, 580], owpYs = [370, 250, 370, 250];
            for (let i = 0; i < Math.min(cnt, owpXs.length); i++) {
                if (!this._overlaps({ x: owpXs[i], y: owpYs[i], w: 120, h: 16 }, lvl.platforms, 30, 30))
                    lvl.oneWayPlatforms.push({ x: owpXs[i], y: owpYs[i], w: 120, h: 16 });
            }
        }

        // ── Teleporters (paired, left/right symmetry) ─────────────────────────
        if (theme === 'teleporters' || theme === 'lasers_teleporters' || theme === 'all') {
            const pairCount = Math.min(Math.floor((num - 16) / 3) + 1, 2);
            const tpairs = [[{ x: 90, y: 180 }, { x: 670, y: 380 }], [{ x: 90, y: 380 }, { x: 670, y: 180 }]];
            for (let i = 0; i < Math.min(pairCount, tpairs.length); i++) {
                const [a, b] = tpairs[i];
                lvl.teleporters.push({ ...a, w: 30, h: 40, pairId: i, side: 'A', cooldown: 0 });
                lvl.teleporters.push({ ...b, w: 30, h: 40, pairId: i, side: 'B', cooldown: 0 });
            }
        }

        // ── Crushers (evenly spaced columns) ─────────────────────────────────
        if (theme === 'crushers' || theme === 'all') {
            const cnt = Math.min(Math.floor((num - 18) / 2) + 1, 4);
            const crushX = [160, 300, 460, 600];
            const speed = 3 + rng() * tier * 0.8;
            for (let i = 0; i < Math.min(cnt, crushX.length); i++)
                lvl.crushers.push({ x: crushX[i], y: 20, w: 40, h: 30, fromY: 20, toY: 560, speed, dir: 1, state: 'waiting', waitTimer: i * 40, waitTime: 80 + i * 10 });
        }

        // ── Patrol Drones (evenly spaced, alternating Y) ──────────────────────
        if (theme === 'drones' || theme === 'wind_gravity_drones' || theme === 'all') {
            const cnt = Math.min(Math.floor((num - 20) / 2) + 1, 4);
            const droneY = [120, 280, 400, 160];
            for (let i = 0; i < Math.min(cnt, droneY.length); i++) {
                const x = 150 + i * 130, y = droneY[i];
                lvl.drones.push({ x, y, w: 28, h: 20, startX: x, startY: y, range: 100 + i * 20, speed: 1.2 + i * 0.15 + tier * 0.25, dir: i % 2 === 0 ? 1 : -1, homing: tier >= 6 && i % 2 === 0 });
            }
        }

        // ── Gravity Mines (diamond pattern) ──────────────────────────────────
        if (theme === 'mines' || theme === 'all') {
            const cnt = Math.min(Math.floor((num - 22) / 3) + 1, 4);
            const minePos = [{ x: 250, y: 200 }, { x: 500, y: 200 }, { x: 350, y: 380 }, { x: 400, y: 130 }];
            for (let i = 0; i < Math.min(cnt, minePos.length); i++) {
                const { x, y } = minePos[i];
                lvl.gravityMines.push({ x, y, r: 16, triggered: false, respawnTimer: 0 });
            }
        }

        // ── Collectibles (uniform horizontal row, alternating Y) ─────────────
        {
            const orbCount = 3 + Math.floor(tier / 3);
            const spacing = Math.floor(600 / (orbCount + 1));
            for (let i = 0; i < orbCount; i++) {
                const cx = 100 + spacing * (i + 1);
                const cy = 150 + (i % 2) * 120;
                if (this._overlaps({ x: cx, y: cy, w: 22, h: 22 }, lvl.platforms, 0, 0)) continue;
                let type = 'normal';
                if (num >= 10 && i === orbCount - 1) type = 'multiplier';
                else if (num >= 6 && i === 1) type = 'shield';
                const moving = num >= 8 && i % 3 === 0;
                lvl.collectibles.push({ x: cx, y: cy, w: 22, h: 22, collected: false, isHidden: i === orbCount - 1 && rng() > 0.6, type, moving, moveDir: i % 2 === 0 ? 1 : -1, moveStartX: cx, moveRange: 30 + rng() * 40, moveSpeed: 0.8 + rng() * 0.8 });
            }
        }

        // ── Level Devil Traps (6 named slot positions, one per slot) ─────────
        if (theme === 'traps' || theme === 'all') {
            const trapBudget = 1 + Math.floor(tier * 1.1);
            const trapSlots = [
                { x: 180, y: 440 }, { x: 380, y: 300 }, { x: 540, y: 160 },
                { x: 280, y: 200 }, { x: 460, y: 440 }, { x: 160, y: 140 },
            ];
            for (let t = 0; t < Math.min(trapBudget, trapSlots.length); t++) {
                const slot = trapSlots[t];
                const roll = rng();
                if (roll < 0.28) {
                    lvl.traps.push({ kind: 'fake_platform', rect: { x: slot.x, y: slot.y, w: PLAT_W - 20, h: 20 }, state: 'solid', timer: 0, collapseDelay: 27, alpha: 1 });
                } else if (roll < 0.52) {
                    const onFloor = slot.y > 300;
                    const ay = onFloor ? 558 : 22;
                    lvl.traps.push({ kind: 'spike_ambush', rect: { x: slot.x, y: ay, w: 60, h: 20 }, spikeRect: { x: slot.x + 4, y: onFloor ? ay - 18 : ay + 20, w: 52, h: 18 }, onFloor, state: 'hidden', timer: 0, triggerDelay: 55, fireDelay: 35 });
                } else if (roll < 0.68 && tier >= 2) {
                    lvl.traps.push({ kind: 'bait_orb', rect: { x: slot.x, y: slot.y, w: 24, h: 24 }, spikeRect: { x: slot.x + 40, y: slot.y, w: 60, h: 18 }, state: 'idle', timer: 0, pulse: 0, triggered: false });
                } else if (roll < 0.80 && tier >= 2) {
                    lvl.traps.push({ kind: 'invert_button', rect: { x: slot.x, y: slot.y, w: 24, h: 24 }, triggered: false, pulse: 0 });
                } else if (roll < 0.92 && tier >= 3) {
                    const fromLeft = t % 2 === 0;
                    const ch = 100 + Math.floor(rng() * 80);
                    lvl.traps.push({ kind: 'crush_wall', rect: { x: fromLeft ? -60 : 860, y: Math.max(40, slot.y - ch / 2), w: 50, h: ch }, fromLeft, targetX: fromLeft ? 120 : 580, speed: 0, state: 'waiting', waitTimer: 0 });
                } else if (tier >= 4) {
                    const onFloor = slot.y > 300;
                    lvl.traps.push({ kind: 'fake_floor', rect: { x: slot.x, y: onFloor ? 560 : 0, w: 100, h: 20 }, onFloor, contactTimer: 0, killDelay: 90, state: 'safe', flashTimer: 0 });
                }
            }
        }

        return lvl;
    }

    // ── Boss Level ────────────────────────────────────────────────────────────
    generateBossLevel(num) {
        const isFinal = num === 100;
        return {
            id: num, title: isFinal ? '⚠ THE FINAL CORE' : `⚠ SECTOR ${num / 5} CORE`,
            playerStart: { x: 50, y: 300 },
            portal: { x: 720, y: 250, w: 60, h: 60 },
            platforms: [
                { x: 0, y: 580, w: 800, h: 20, type: 'static' },
                { x: 0, y: 0, w: 800, h: 20, type: 'static' },
                { x: 0, y: 300, w: 100, h: 20, type: 'static' },
                { x: 700, y: 300, w: 100, h: 20, type: 'static' },
                { x: 340, y: 200, w: 120, h: 20, type: 'static' },
                { x: 340, y: 400, w: 120, h: 20, type: 'static' },
            ],
            movingPlatforms: [
                { x: 200, y: 280, w: 80, h: 20, startX: 200, startY: 280, range: 130, axis: 'y', speed: 3 },
                { x: 500, y: 320, w: 80, h: 20, startX: 500, startY: 320, range: 130, axis: 'y', speed: 3 },
            ],
            lasers: [
                { x: 395, y: 22, w: 14, h: 556, active: true, timer: 0, interval: isFinal ? 40 : 55, isVertical: true, sweeps: false },
                { x: 20, y: 295, w: 760, h: 14, active: true, timer: 30, interval: isFinal ? 50 : 70, isVertical: false, sweeps: true, sweepDir: 1, sweepOffset: 0, sweepRange: 200 },
            ],
            hazards: [
                { x: 340, y: 185, w: 120, h: 15, type: 'spikes' },
                { x: 340, y: 420, w: 120, h: 15, type: 'spikes_inverted' },
            ],
            disappearingPlatforms: [
                { x: 200, y: 450, w: 100, h: 20, alpha: 1, state: 'solid', timer: 0, solidTime: 80, fadeTime: 50, respawnTime: 70 },
                { x: 500, y: 150, w: 100, h: 20, alpha: 1, state: 'solid', timer: 0, solidTime: 80, fadeTime: 50, respawnTime: 70 },
            ],
            sawBlades: [
                { x: 200, y: 295, r: 16, startX: 200, range: 120, speed: isFinal ? 5 : 3, angle: 0, axis: 'x' },
                { x: 500, y: 295, r: 16, startX: 500, range: 120, speed: isFinal ? 5 : 3, angle: 0, axis: 'x' },
            ],
            windZones: [
                { x: 0, y: 100, w: 120, h: 400, fx: 0.5, fy: 0 },
                { x: 680, y: 100, w: 120, h: 400, fx: -0.5, fy: 0 },
            ],
            gravityZones: [
                { x: 300, y: 50, w: 200, h: 100, dir: -1 },
                { x: 300, y: 450, w: 200, h: 100, dir: 1 },
            ],
            oneWayPlatforms: [
                { x: 130, y: 200, w: 80, h: 16 },
                { x: 600, y: 400, w: 80, h: 16 },
            ],
            teleporters: [
                { x: 50, y: 200, w: 30, h: 40, pairId: 0, side: 'A', cooldown: 0 },
                { x: 720, y: 400, w: 30, h: 40, pairId: 0, side: 'B', cooldown: 0 },
            ],
            crushers: [
                { x: 250, y: 20, w: 40, h: 30, fromY: 20, toY: 560, speed: isFinal ? 7 : 5, dir: 1, state: 'waiting', waitTimer: 0, waitTime: isFinal ? 40 : 60 },
                { x: 510, y: 20, w: 40, h: 30, fromY: 20, toY: 560, speed: isFinal ? 7 : 5, dir: 1, state: 'waiting', waitTimer: 30, waitTime: isFinal ? 40 : 60 },
            ],
            drones: [
                { x: 200, y: 150, w: 28, h: 20, startX: 200, startY: 150, range: 150, speed: 3, dir: 1, homing: true },
                { x: 450, y: 430, w: 28, h: 20, startX: 450, startY: 430, range: 150, speed: 3, dir: 1, homing: true },
            ],
            turrets: [
                { x: 390, y: 180, w: 20, h: 20, fireTimer: 0, fireInterval: 50, projectiles: [] },
                { x: 390, y: 360, w: 20, h: 20, fireTimer: 25, fireInterval: 50, projectiles: [] },
            ],
            gravityMines: [
                { x: 160, y: 300, r: 18, triggered: false, respawnTimer: 0 },
                { x: 640, y: 300, r: 18, triggered: false, respawnTimer: 0 },
            ],
            barrels: [
                { x: 340, y: 174, w: 26, h: 26, exploding: false, blastTimer: 0, blastDuration: 30, blastR: 0, maxBlastR: 70, respawnTimer: 0, respawnTime: 300 },
            ],
            speedPads: [
                { x: 10, y: 288, w: 40, h: 12, _active: false },
                { x: 750, y: 288, w: 40, h: 12, _active: false },
            ],
            bouncePads: [
                { x: 350, y: 386, w: 45, h: 14, _bounced: false, _animTimer: 0 },
            ],
            collectibles: [
                { x: 390, y: 100, w: 22, h: 22, collected: false, type: 'normal', moving: false },
                { x: 390, y: 480, w: 22, h: 22, collected: false, type: 'multiplier', moving: false },
                { x: 390, y: 295, w: 22, h: 22, collected: false, type: 'shield', moving: false, isCore: true },
            ],
            traps: [
                // Fake platform between the two static mid-platforms — looks safe, collapses fast
                { kind: 'fake_platform', rect: { x: 200, y: 250, w: 100, h: 20 }, state: 'solid', timer: 0, collapseDelay: 18, alpha: 1 },
                // Spike ambush — left floor
                { kind: 'spike_ambush', rect: { x: 100, y: 558, w: 70, h: 20 }, spikeRect: { x: 104, y: 540, w: 62, h: 18 }, onFloor: true, state: 'hidden', timer: 0, triggerDelay: 35, fireDelay: 30 },
                // Spike ambush — ceiling right side
                { kind: 'spike_ambush', rect: { x: 600, y: 2, w: 70, h: 20 }, spikeRect: { x: 604, y: 22, w: 62, h: 18 }, onFloor: false, state: 'hidden', timer: 0, triggerDelay: 35, fireDelay: 30 },
                // Bait orb — near the portal, extremely tempting
                { kind: 'bait_orb', rect: { x: 688, y: 238, w: 24, h: 24 }, spikeRect: { x: 620, y: 270, w: 80, h: 18 }, state: 'idle', timer: 0, pulse: 0, triggered: false },
                // Invert button — disguised at the mid-crossing point
                { kind: 'invert_button', rect: { x: 388, y: 278, w: 24, h: 24 }, triggered: false, pulse: 0 },
                // Crush wall from left
                { kind: 'crush_wall', rect: { x: -60, y: 100, w: 50, h: 400 }, fromLeft: true, targetX: 150, speed: 0, state: 'waiting', waitTimer: 0 },
                // Crush wall from right
                { kind: 'crush_wall', rect: { x: 860, y: 100, w: 50, h: 400 }, fromLeft: false, targetX: 600, speed: 0, state: 'waiting', waitTimer: 0 },
            ],
        };
    }

    _plat(lvl, x, y, w, h) { lvl.platforms.push({ x, y, w, h, type: 'static' }); }

    _overlaps(a, list, px = 60, py = 60) {
        for (const b of list) {
            if (a.x - px < b.x + b.w && a.x + (a.w || 0) + px > b.x &&
                a.y - py < b.y + b.h && a.y + (a.h || 0) + py > b.y) return true;
        }
        return false;
    }
}

export const LEVELS = new LevelGenerator().generateAllLevels();

// ─── Level Runtime Class ──────────────────────────────────────────────────────
export class Level {
    constructor(data, levelNum = 1) {
        const d = JSON.parse(JSON.stringify(data));
        this.id = d.id;
        this.title = d.title;
        this.levelNum = levelNum;

        this.platforms = d.platforms || [];
        this.movingPlatforms = d.movingPlatforms || [];
        this.hazards = d.hazards || [];
        this.lasers = d.lasers || [];
        this.disappearingPlatforms = d.disappearingPlatforms || [];
        this.sawBlades = d.sawBlades || [];
        this.windZones = d.windZones || [];
        this.gravityZones = d.gravityZones || [];
        this.oneWayPlatforms = d.oneWayPlatforms || [];
        this.teleporters = d.teleporters || [];
        this.crushers = d.crushers || [];
        this.drones = d.drones || [];
        this.turrets = d.turrets || [];
        this.collectibles = d.collectibles || [];
        this.speedPads = d.speedPads || [];
        this.bouncePads = d.bouncePads || [];
        this.gravityMines = d.gravityMines || [];
        this.barrels = d.barrels || [];
        this.traps = d.traps || [];
        this.portal = d.portal;
        this.playerStart = d.playerStart;
        this._trickKill = null;

        const tier = Math.ceil(levelNum / 5);
        const laserScale = Math.max(0.35, 1 - (tier - 1) * 0.08);
        const platSpeedMul = 1 + (tier - 1) * 0.12;

        this.lasers.forEach(l => { l.interval = Math.max(35, Math.floor(l.interval * laserScale)); });
        this.movingPlatforms.forEach(p => { p.speed *= platSpeedMul; });

        this.collectibleValue = 10 + (levelNum - 1) * 2;
        this._teleCooldownGlobal = 0;
    }

    // ── Update ────────────────────────────────────────────────────────────────
    update(player) {
        this._updateMovingPlatforms();
        this._updateLasers();
        this._updateDisappearingPlatforms();
        this._updateSawBlades();
        this._updateCrushers();
        this._updateDrones(player);
        this._updateTurrets();
        this._updateGravityMines();
        this._updateBarrels(player);
        this._updateBouncePads();
        this._updateMovingCollectibles();
        this._updateTraps();
        if (this._teleCooldownGlobal > 0) this._teleCooldownGlobal--;
        this.teleporters.forEach(t => { if (t.cooldown > 0) t.cooldown--; });
    }

    _updateMovingPlatforms() {
        this.movingPlatforms.forEach(p => {
            if (p.axis === 'x') {
                p.x += p.speed;
                if (p.x > p.startX + p.range || p.x < p.startX - p.range) p.speed *= -1;
            } else {
                p.y += p.speed;
                if (p.y > p.startY + p.range || p.y < p.startY - p.range) p.speed *= -1;
            }
        });
    }

    _updateLasers() {
        this.lasers.forEach(l => {
            if (l.sweeps) {
                // Sweeping laser: moves along its perp axis
                l.sweepOffset += l.sweepDir * 1.5;
                if (Math.abs(l.sweepOffset) >= l.sweepRange / 2) l.sweepDir *= -1;
                if (l.isVertical) l.x = (l._origX || (l._origX = l.x)) + l.sweepOffset;
                else l.y = (l._origY || (l._origY = l.y)) + l.sweepOffset;
                l.active = true;
            } else {
                l.timer++;
                if (l.timer > l.interval) { l.timer = 0; l.active = !l.active; }
            }
        });
    }

    _updateDisappearingPlatforms() {
        this.disappearingPlatforms.forEach(p => {
            p.timer++;
            if (p.state === 'solid') {
                p.alpha = 1;
                if (p._touched && p.timer >= p.solidTime) { p.state = 'fading'; p.timer = 0; }
            } else if (p.state === 'fading') {
                p.alpha = 1 - p.timer / p.fadeTime;
                if (p.timer >= p.fadeTime) { p.state = 'gone'; p.timer = 0; p.alpha = 0; }
            } else if (p.state === 'gone') {
                if (p.timer >= p.respawnTime) { p.state = 'solid'; p.timer = 0; p._touched = false; p.alpha = 1; }
            }
        });
    }

    _updateSawBlades() {
        this.sawBlades.forEach(s => {
            s.x += s.speed;
            if (s.x > s.startX + s.range || s.x < s.startX - s.range) s.speed *= -1;
            s.angle += 0.08;
        });
    }

    _updateCrushers() {
        this.crushers.forEach(c => {
            if (c.state === 'waiting') {
                c.waitTimer++;
                if (c.waitTimer >= c.waitTime) { c.state = 'moving'; c.waitTimer = 0; }
            } else {
                c.y += c.speed * c.dir;
                if (c.y + c.h >= c.toY) c.dir = -1;
                if (c.y <= c.fromY) { c.dir = 1; c.state = 'waiting'; }
            }
        });
    }

    _updateDrones(player) {
        this.drones.forEach(d => {
            if (d.homing && player && !player.dead) {
                // Homing: steer toward player (limited turn speed)
                const tx = player.x + player.width / 2;
                const ty = player.y + player.height / 2;
                const dx = tx - d.x;
                const dy = ty - d.y;
                const dist = Math.hypot(dx, dy) || 1;
                d.vx = (d.vx || 0) * 0.9 + (dx / dist) * d.speed * 0.15;
                d.vy = (d.vy || 0) * 0.9 + (dy / dist) * d.speed * 0.15;
                d.x += d.vx;
                d.y += d.vy;
            } else {
                d.x += d.speed * d.dir;
                if (d.x > d.startX + d.range || d.x < d.startX - d.range) d.dir *= -1;
            }
        });
    }

    _updateTurrets() {
        this.turrets.forEach(t => {
            t.fireTimer++;
            if (t.fireTimer >= t.fireInterval) {
                t.fireTimer = 0;
                t.projectiles.push({ x: t.x, y: t.y + 10, vx: -3, vy: 0, w: 10, h: 6 });
                t.projectiles.push({ x: t.x, y: t.y + 10, vx: 3, vy: 0, w: 10, h: 6 });
            }
            t.projectiles.forEach(p => { p.x += p.vx; p.y += p.vy; });
            t.projectiles = t.projectiles.filter(p => p.x > -20 && p.x < 820);
        });
    }

    _updateGravityMines() {
        this.gravityMines.forEach(m => {
            if (m.triggered) {
                m.respawnTimer--;
                if (m.respawnTimer <= 0) { m.triggered = false; }
            }
        });
    }

    _updateBarrels(player) {
        this.barrels.forEach(b => {
            if (b.respawnTimer > 0) { b.respawnTimer--; return; }
            if (b.exploding) {
                b.blastTimer++;
                b.blastR = (b.blastTimer / b.blastDuration) * b.maxBlastR;
                if (b.blastTimer >= b.blastDuration) {
                    b.exploding = false; b.blastTimer = 0; b.blastR = 0;
                    b.respawnTimer = b.respawnTime;
                }
            } else if (player && !player.dead) {
                // Trigger if player walks close
                const px = player.x + player.width / 2;
                const py = player.y + player.height / 2;
                const bx = b.x + b.w / 2, by = b.y + b.h / 2;
                if (Math.hypot(px - bx, py - by) < 55) {
                    b.exploding = true;
                    b.blastTimer = 0;
                }
            }
        });
    }

    _updateBouncePads() {
        this.bouncePads.forEach(p => {
            if (p._animTimer > 0) p._animTimer--;
        });
    }

    _updateMovingCollectibles() {
        this.collectibles.forEach(c => {
            if (!c.moving || c.collected) return;
            c.x += c.moveDir * c.moveSpeed;
            if (Math.abs(c.x - c.moveStartX) >= c.moveRange) c.moveDir *= -1;
        });
    }

    // ── Draw ──────────────────────────────────────────────────────────────────
    draw(ctx) {
        this._drawGravityZones(ctx);
        this._drawWindZones(ctx);
        this._drawTraps(ctx);           // drawn first so fake platforms blend with real ones
        this._drawStaticPlatforms(ctx);
        this._drawOneWayPlatforms(ctx);
        this._drawMovingPlatforms(ctx);
        this._drawDisappearingPlatforms(ctx);
        this._drawCrushers(ctx);
        this._drawHazards(ctx);
        this._drawLasers(ctx);
        this._drawSawBlades(ctx);
        this._drawTeleporters(ctx);
        this._drawDrones(ctx);
        this._drawTurrets(ctx);
        this._drawSpeedPads(ctx);
        this._drawBouncePads(ctx);
        this._drawGravityMines(ctx);
        this._drawBarrels(ctx);
        this._drawCollectibles(ctx);
        this._drawPortal(ctx);
    }

    _drawStaticPlatforms(ctx) {
        this.platforms.forEach(p => {
            if (p.type === 'wall') {
                // Wall obstacles — red/orange neon pillar with diagonal hazard stripes
                ctx.save();
                ctx.fillStyle = '#1a0808';
                ctx.strokeStyle = '#ff4400';
                ctx.lineWidth = 2;
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#ff4400';
                ctx.fillRect(p.x, p.y, p.w, p.h);
                ctx.strokeRect(p.x, p.y, p.w, p.h);
                // Diagonal stripes
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 0.35;
                ctx.fillStyle = '#ff6600';
                const stripeGap = 12;
                ctx.save();
                ctx.beginPath();
                ctx.rect(p.x, p.y, p.w, p.h);
                ctx.clip();
                for (let s = -p.h; s < p.w + p.h; s += stripeGap) {
                    ctx.fillRect(p.x + s, p.y, 5, p.h * 2);
                }
                ctx.restore();
                ctx.restore();
            } else {
                ctx.fillStyle = '#1a1a3a';
                ctx.strokeStyle = '#00f3ff';
                ctx.lineWidth = 2;
                ctx.shadowBlur = 0;
                ctx.fillRect(p.x, p.y, p.w, p.h);
                ctx.strokeRect(p.x, p.y, p.w, p.h);
            }
        });
    }

    _drawOneWayPlatforms(ctx) {
        ctx.fillStyle = 'rgba(0,200,255,0.25)';
        ctx.strokeStyle = '#00ccff';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        this.oneWayPlatforms.forEach(p => { ctx.fillRect(p.x, p.y, p.w, p.h); ctx.strokeRect(p.x, p.y, p.w, p.h); });
        ctx.setLineDash([]);
    }

    _drawMovingPlatforms(ctx) {
        ctx.fillStyle = '#2a2a5a';
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 2;
        this.movingPlatforms.forEach(p => {
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeRect(p.x, p.y, p.w, p.h);
            ctx.save();
            ctx.globalAlpha = 0.18;
            ctx.strokeStyle = '#ff00ff';
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            if (p.axis === 'x') { ctx.moveTo(p.startX - p.range, p.y + p.h / 2); ctx.lineTo(p.startX + p.range, p.y + p.h / 2); }
            else { ctx.moveTo(p.x + p.w / 2, p.startY - p.range); ctx.lineTo(p.x + p.w / 2, p.startY + p.range); }
            ctx.stroke();
            ctx.restore();
        });
    }

    _drawDisappearingPlatforms(ctx) {
        this.disappearingPlatforms.forEach(p => {
            if (p.state === 'gone') return;
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = '#3a3a00'; ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 2;
            ctx.fillRect(p.x, p.y, p.w, p.h); ctx.strokeRect(p.x, p.y, p.w, p.h);
            ctx.restore();
        });
    }

    _drawHazards(ctx) {
        ctx.fillStyle = '#ff0055';
        this.hazards.forEach(h => {
            ctx.beginPath();
            if (h.type === 'spikes') {
                for (let i = 0; i < h.w; i += 10) { ctx.moveTo(h.x + i, h.y + h.h); ctx.lineTo(h.x + i + 5, h.y); ctx.lineTo(h.x + i + 10, h.y + h.h); }
            } else {
                for (let i = 0; i < h.w; i += 10) { ctx.moveTo(h.x + i, h.y); ctx.lineTo(h.x + i + 5, h.y + h.h); ctx.lineTo(h.x + i + 10, h.y); }
            }
            ctx.fill();
        });
    }

    _drawLasers(ctx) {
        this.lasers.forEach(l => {
            if (l.active) {
                ctx.fillStyle = 'rgba(255,0,0,0.85)';
                ctx.shadowBlur = 16; ctx.shadowColor = '#ff0000';
                ctx.fillRect(l.x, l.y, l.w, l.h);
                ctx.fillStyle = '#fff';
                ctx.fillRect(l.x + l.w * 0.3, l.y + l.h * 0.3, l.w * 0.4, l.h * 0.4);
                // Sweeping label
                if (l.sweeps) { ctx.fillStyle = 'rgba(255,100,0,0.7)'; ctx.font = '9px Orbitron,monospace'; ctx.fillText('SWEEP', l.x + 2, l.y - 2); }
                ctx.shadowBlur = 0;
            } else {
                ctx.fillStyle = 'rgba(255,0,0,0.18)';
                ctx.fillRect(l.x, l.y, l.w, l.h);
            }
        });
    }

    _drawSawBlades(ctx) {
        this.sawBlades.forEach(s => {
            ctx.save();
            ctx.translate(s.x, s.y); ctx.rotate(s.angle);
            ctx.fillStyle = '#ff6600'; ctx.strokeStyle = '#ff3300'; ctx.lineWidth = 2;
            ctx.shadowBlur = 8; ctx.shadowColor = '#ff6600';
            ctx.beginPath();
            const teeth = 8;
            for (let i = 0; i < teeth * 2; i++) {
                const angle = (i / (teeth * 2)) * Math.PI * 2;
                const r = i % 2 === 0 ? s.r : s.r * 0.6;
                if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
                else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
            }
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.restore();
        });
    }

    _drawWindZones(ctx) {
        this.windZones.forEach(z => {
            ctx.save();
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = z.fx > 0 ? '#00aaff' : z.fx < 0 ? '#aa00ff' : '#00ffaa';
            ctx.fillRect(z.x, z.y, z.w, z.h);
            ctx.globalAlpha = 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
            const cx = z.x + z.w / 2, cy = z.y + z.h / 2, len = 20;
            ctx.beginPath(); ctx.moveTo(cx - z.fx * len, cy - z.fy * len); ctx.lineTo(cx + z.fx * len, cy + z.fy * len); ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        });
    }

    _drawGravityZones(ctx) {
        this.gravityZones.forEach(z => {
            ctx.save();
            const col = z.dir === -1 ? '#ff00ff' : '#00ff88';
            ctx.globalAlpha = 0.18; ctx.fillStyle = col; ctx.fillRect(z.x, z.y, z.w, z.h);
            ctx.globalAlpha = 0.7; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
            ctx.strokeRect(z.x, z.y, z.w, z.h); ctx.setLineDash([]);
            ctx.fillStyle = col; ctx.globalAlpha = 0.9; ctx.font = '11px Orbitron,monospace';
            ctx.fillText(z.dir === -1 ? '▲ GRAV' : '▼ GRAV', z.x + 4, z.y + 14);
            ctx.restore();
        });
    }

    _drawTeleporters(ctx) {
        this.teleporters.forEach(t => {
            const col = t.side === 'A' ? '#00ffff' : '#ff00ff';
            ctx.save();
            ctx.fillStyle = col; ctx.shadowBlur = 14; ctx.shadowColor = col;
            ctx.globalAlpha = t.cooldown > 0 ? 0.35 : 0.9;
            ctx.fillRect(t.x, t.y, t.w, t.h);
            ctx.fillStyle = '#000'; ctx.font = '10px Orbitron,monospace'; ctx.globalAlpha = 1; ctx.shadowBlur = 0;
            ctx.fillText(t.side, t.x + 8, t.y + 24);
            ctx.restore();
        });
    }

    _drawCrushers(ctx) {
        this.crushers.forEach(c => {
            ctx.save();
            ctx.fillStyle = '#cc2200'; ctx.strokeStyle = '#ff4400'; ctx.lineWidth = 2;
            ctx.shadowBlur = 10; ctx.shadowColor = '#ff4400';
            ctx.fillRect(c.x, c.y, c.w, c.h); ctx.strokeRect(c.x, c.y, c.w, c.h);
            ctx.globalAlpha = 0.4; ctx.fillStyle = '#ffff00';
            for (let i = 0; i < 3; i++) ctx.fillRect(c.x + 4 + i * 11, c.y + 4, 6, c.h - 8);
            ctx.restore();
        });
    }

    _drawDrones(ctx) {
        this.drones.forEach(d => {
            ctx.save();
            ctx.fillStyle = d.homing ? '#ff0088' : '#ff4400';
            ctx.strokeStyle = d.homing ? '#ff66cc' : '#ff8800';
            ctx.lineWidth = 2; ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle;
            ctx.beginPath(); ctx.ellipse(d.x + d.w / 2, d.y + d.h / 2, d.w / 2, d.h / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.shadowBlur = 0;
            ctx.beginPath(); ctx.arc(d.x + d.w / 2, d.y + d.h / 2, 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = d.homing ? '#ff0088' : '#ff0000';
            ctx.beginPath(); ctx.arc(d.x + d.w / 2, d.y + d.h / 2, 2, 0, Math.PI * 2); ctx.fill();
            if (d.homing) {
                ctx.strokeStyle = 'rgba(255,0,136,0.3)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
                ctx.beginPath(); ctx.arc(d.x + d.w / 2, d.y + d.h / 2, 18, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]);
            }
            ctx.restore();
        });
    }

    _drawTurrets(ctx) {
        this.turrets.forEach(t => {
            ctx.save();
            ctx.fillStyle = '#880000'; ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 2; ctx.shadowBlur = 8; ctx.shadowColor = '#ff0000';
            ctx.fillRect(t.x, t.y, t.w, t.h); ctx.strokeRect(t.x, t.y, t.w, t.h); ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffaa00'; ctx.shadowBlur = 6; ctx.shadowColor = '#ffaa00';
            t.projectiles.forEach(p => ctx.fillRect(p.x, p.y, p.w, p.h));
            ctx.restore();
        });
    }

    _drawSpeedPads(ctx) {
        this.speedPads.forEach(p => {
            ctx.save();
            ctx.fillStyle = p._active ? '#ff6600' : '#ff8800';
            ctx.shadowBlur = p._active ? 16 : 8; ctx.shadowColor = '#ff8800';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            // Arrow chevrons
            ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.8;
            for (let i = 0; i < 3; i++) {
                const ax = p.x + 5 + i * 12;
                ctx.beginPath(); ctx.moveTo(ax, p.y + 3); ctx.lineTo(ax + 7, p.y + p.h / 2); ctx.lineTo(ax, p.y + p.h - 3); ctx.stroke();
            }
            ctx.restore();
        });
    }

    _drawBouncePads(ctx) {
        this.bouncePads.forEach(p => {
            ctx.save();
            const compress = p._animTimer > 0 ? 0.6 : 1;
            const yOff = p._animTimer > 0 ? p.h * 0.4 : 0;
            ctx.fillStyle = '#00ff88'; ctx.shadowBlur = 12; ctx.shadowColor = '#00ff88';
            ctx.fillRect(p.x, p.y + yOff, p.w, p.h * compress);
            // Spring coils
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7;
            for (let i = 0; i < 4; i++) {
                const bx = p.x + 5 + i * (p.w - 10) / 3;
                ctx.beginPath(); ctx.moveTo(bx, p.y + yOff); ctx.lineTo(bx, p.y + p.h * compress + yOff); ctx.stroke();
            }
            ctx.restore();
        });
    }

    _drawGravityMines(ctx) {
        this.gravityMines.forEach(m => {
            if (m.triggered) return;
            ctx.save();
            ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 2; ctx.shadowBlur = 14; ctx.shadowColor = '#ff00ff';
            ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = '#ff00ff'; ctx.globalAlpha = 0.3;
            ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center'; ctx.fillText('⊕G', m.x, m.y + 4);
            ctx.restore();
        });
    }

    _drawBarrels(ctx) {
        this.barrels.forEach(b => {
            if (b.respawnTimer > 0) return;
            ctx.save();
            if (b.exploding) {
                // Blast circle
                const alpha = 1 - b.blastTimer / b.blastDuration;
                ctx.globalAlpha = alpha * 0.7;
                ctx.fillStyle = '#ff6600'; ctx.shadowBlur = 20; ctx.shadowColor = '#ff3300';
                ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.blastR, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = alpha * 0.4;
                ctx.fillStyle = '#ffff00';
                ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.blastR * 0.5, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.fillStyle = '#8b4513'; ctx.strokeStyle = '#ff3300'; ctx.lineWidth = 2;
                ctx.shadowBlur = 6; ctx.shadowColor = '#ff4400';
                ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeRect(b.x, b.y, b.w, b.h);
                // Barrel bands
                ctx.fillStyle = '#5a2d0c';
                for (let i = 1; i <= 2; i++) ctx.fillRect(b.x, b.y + (b.h / 3) * i - 2, b.w, 4);
                ctx.fillStyle = '#ff3300'; ctx.globalAlpha = 0.9; ctx.font = 'bold 9px monospace';
                ctx.textAlign = 'center'; ctx.fillText('💥', b.x + b.w / 2, b.y + b.h / 2 + 4);
            }
            ctx.restore();
        });
    }

    _drawCollectibles(ctx) {
        this.collectibles.forEach(c => {
            if (c.collected) return;
            let col, innerCol, label;
            if (c.type === 'shield') { col = '#00aaff'; innerCol = '#66ccff'; label = '🛡'; }
            else if (c.type === 'multiplier') { col = '#ff00ff'; innerCol = '#ff88ff'; label = '×'; }
            else { col = c.isHidden ? '#aaffaa' : '#ccff00'; innerCol = null; label = null; }

            ctx.save();
            ctx.fillStyle = col; ctx.shadowBlur = c.isHidden ? 4 : 14; ctx.shadowColor = col;
            ctx.beginPath(); ctx.arc(c.x + c.w / 2, c.y + c.h / 2, c.w / 2, 0, Math.PI * 2); ctx.fill();

            if (innerCol) {
                ctx.fillStyle = innerCol; ctx.shadowBlur = 4;
                ctx.beginPath(); ctx.arc(c.x + c.w / 2, c.y + c.h / 2, c.w / 4, 0, Math.PI * 2); ctx.fill();
            }
            if (c.moving) {
                ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.globalAlpha = 0.4; ctx.setLineDash([3, 3]);
                ctx.beginPath(); ctx.moveTo(c.moveStartX - c.moveRange, c.y + c.h / 2);
                ctx.lineTo(c.moveStartX + c.moveRange, c.y + c.h / 2); ctx.stroke();
                ctx.setLineDash([]);
            }
            ctx.restore();
        });
    }

    _drawPortal(ctx) {
        const p = this.portal;
        ctx.fillStyle = '#00f3ff'; ctx.shadowBlur = 22; ctx.shadowColor = '#00f3ff';
        ctx.fillRect(p.x, p.y, p.w, p.h); ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff'; ctx.fillRect(p.x + 5, p.y + 5, p.w - 10, p.h - 10);
    }

    // ── Trap Update ───────────────────────────────────────────────────────────
    _updateTraps() {
        for (const trap of this.traps) {
            trap.pulse = (trap.pulse || 0) + 0.07;

            if (trap.kind === 'fake_platform') {
                if (trap.state === 'solid') {
                    trap.timer = Math.max(0, trap.timer - 1);
                    if (trap.timer === 0) trap.alpha = 1;
                } else if (trap.state === 'collapsing') {
                    trap.timer++;
                    // Flicker warning
                    trap.alpha = 0.3 + 0.7 * (Math.sin(trap.timer * 1.2) * 0.5 + 0.5);
                    if (trap.timer >= trap.collapseDelay) {
                        trap.state = 'gone'; trap.timer = 0; trap.alpha = 0;
                    }
                } else if (trap.state === 'gone') {
                    trap.timer++;
                    if (trap.timer > 300) { trap.state = 'solid'; trap.timer = 0; trap.alpha = 1; }
                }

            } else if (trap.kind === 'spike_ambush') {
                if (trap.state === 'arming') {
                    trap.timer++;
                    if (trap.timer >= trap.triggerDelay) { trap.state = 'firing'; trap.timer = 0; }
                } else if (trap.state === 'firing') {
                    trap.timer++;
                    if (trap.timer >= trap.fireDelay + 80) { trap.state = 'hidden'; trap.timer = 0; }
                }

            } else if (trap.kind === 'crush_wall') {
                if (trap.state === 'waiting') {
                    trap.waitTimer = (trap.waitTimer || 0) + 1;
                } else if (trap.state === 'rushing') {
                    trap.speed = Math.min((trap.speed || 0) + 0.9, 15);
                    trap.rect.x += trap.fromLeft ? trap.speed : -trap.speed;
                    const past = trap.fromLeft ? trap.rect.x >= trap.targetX : trap.rect.x <= trap.targetX;
                    if (past) trap.state = 'returning';
                } else if (trap.state === 'returning') {
                    trap.rect.x += trap.fromLeft ? -4 : 4;
                    const back = trap.fromLeft ? trap.rect.x <= -60 : trap.rect.x >= 870;
                    if (back) { trap.state = 'waiting'; trap.waitTimer = 0; trap.speed = 0; }
                }

            } else if (trap.kind === 'fake_floor') {
                if (trap.state !== 'lethal') {
                    trap.contactTimer = Math.max(0, (trap.contactTimer || 0) - 2);
                    if (trap.contactTimer === 0) trap.flashTimer = 0;
                }
            }
        }
    }

    // Called by game.js — returns false (no kill), true (kill), or 'invert' (gravity flip trick)
    checkTraps(player) {
        this._trickKill = null;
        for (const trap of this.traps) {

            if (trap.kind === 'fake_platform') {
                if (trap.state !== 'solid') continue;
                const r = trap.rect;
                const onTopEdge = !player.gravityInverted &&
                    player.x + player.width > r.x + 2 && player.x < r.x + r.w - 2 &&
                    Math.abs((player.y + player.height) - r.y) <= 5 && player.vy >= -1;
                const onBotEdge = player.gravityInverted &&
                    player.x + player.width > r.x + 2 && player.x < r.x + r.w - 2 &&
                    Math.abs(player.y - (r.y + r.h)) <= 5 && player.vy <= 1;
                if (onTopEdge || onBotEdge) {
                    trap.state = 'collapsing'; trap.timer = 0;
                }

            } else if (trap.kind === 'spike_ambush') {
                const r = trap.rect;
                const px = player.x + player.width / 2, py = player.y + player.height / 2;
                const near = Math.abs(px - (r.x + r.w / 2)) < 100 && Math.abs(py - (r.y + r.h / 2)) < 130;
                if (trap.state === 'hidden' && near) { trap.state = 'arming'; trap.timer = 0; }
                if (trap.state === 'firing' && trap.timer > 10) {
                    if (this._colRect(player, trap.spikeRect)) {
                        this._trickKill = '💀 The floor had OTHER plans.';
                        return true;
                    }
                }

            } else if (trap.kind === 'bait_orb') {
                if (trap.triggered) continue;
                if (this._colRect(player, trap.rect)) {
                    trap.triggered = true; trap.state = 'gone';
                    this._trickKill = '🪤 That orb was a 100% lie.';
                    return true;
                }

            } else if (trap.kind === 'invert_button') {
                if (trap.triggered) continue;
                if (this._colRect(player, trap.rect)) {
                    trap.triggered = true;
                    return 'invert'; // caller flips gravity
                }

            } else if (trap.kind === 'crush_wall') {
                if (trap.state === 'waiting' && trap.waitTimer > 20) {
                    const px = player.x + player.width / 2;
                    const playerOnSide = trap.fromLeft ? px < 420 : px > 380;
                    if (playerOnSide) { trap.state = 'rushing'; trap.speed = 0; }
                }
                if (trap.state === 'rushing' && this._colRect(player, trap.rect)) {
                    this._trickKill = '🧱 Wall says no.';
                    return true;
                }

            } else if (trap.kind === 'fake_floor') {
                const r = trap.rect;
                const touching = this._colRect(player, r);
                if (touching) {
                    trap.contactTimer = (trap.contactTimer || 0) + 1;
                    trap.flashTimer = (trap.flashTimer || 0) + 1;
                    if (trap.contactTimer >= trap.killDelay) {
                        trap.state = 'lethal';
                        this._trickKill = '☢️ Radioactive floor. Classic.';
                        return true;
                    }
                } else {
                    trap.contactTimer = Math.max(0, (trap.contactTimer || 0) - 2);
                    if (trap.contactTimer === 0) { trap.state = 'safe'; trap.flashTimer = 0; }
                }
            }
        }
        return false;
    }

    _colRect(a, b) {
        return (a.x < b.x + (b.w || 0) && a.x + (a.width || a.w || 0) > b.x &&
            a.y < b.y + (b.h || 0) && a.y + (a.height || a.h || 0) > b.y);
    }

    // ── Trap Draw ─────────────────────────────────────────────────────────────
    _drawTraps(ctx) {
        for (const trap of this.traps) {
            if (trap.kind === 'fake_platform') {
                if (trap.state === 'gone') continue;
                ctx.save();
                ctx.globalAlpha = trap.alpha ?? 1;
                // Looks EXACTLY like a real static platform — same colors
                ctx.fillStyle = '#1a1a3a';
                ctx.strokeStyle = trap.state === 'collapsing' ? '#ff4400' : '#00f3ff';
                ctx.lineWidth = 2;
                const r = trap.rect;
                ctx.fillRect(r.x, r.y, r.w, r.h);
                ctx.strokeRect(r.x, r.y, r.w, r.h);
                // Crack lines when collapsing
                if (trap.state === 'collapsing') {
                    ctx.strokeStyle = 'rgba(255,130,0,0.7)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(r.x + r.w * 0.3, r.y); ctx.lineTo(r.x + r.w * 0.45, r.y + r.h);
                    ctx.moveTo(r.x + r.w * 0.6, r.y); ctx.lineTo(r.x + r.w * 0.5, r.y + r.h);
                    ctx.stroke();
                }
                ctx.restore();

            } else if (trap.kind === 'spike_ambush') {
                const r = trap.rect;
                // Floor/ceiling tile — looks like the regular floor tile
                ctx.save();
                const arming = trap.state === 'arming';
                ctx.fillStyle = arming ? '#2a1000' : '#1a1a3a';
                ctx.strokeStyle = arming ? `rgba(255,100,0,${0.4 + 0.6 * Math.sin(trap.pulse * 3)})` : '#00f3ff';
                ctx.lineWidth = 2;
                ctx.fillRect(r.x, r.y, r.w, r.h);
                ctx.strokeRect(r.x, r.y, r.w, r.h);
                ctx.restore();
                // Spikes shoot out when firing
                if (trap.state === 'firing') {
                    const sr = trap.spikeRect;
                    const progress = Math.min(1, (trap.timer / trap.fireDelay) * 1.8);
                    const visH = sr.h * progress;
                    ctx.save();
                    ctx.fillStyle = '#ff0055';
                    ctx.shadowBlur = 10; ctx.shadowColor = '#ff0055';
                    ctx.beginPath();
                    const sy = trap.onFloor ? sr.y + sr.h - visH : sr.y;
                    for (let i = 0; i < sr.w; i += 10) {
                        if (trap.onFloor) {
                            ctx.moveTo(sr.x + i, sy + visH);
                            ctx.lineTo(sr.x + i + 5, sy);
                            ctx.lineTo(sr.x + i + 10, sy + visH);
                        } else {
                            ctx.moveTo(sr.x + i, sy);
                            ctx.lineTo(sr.x + i + 5, sy + visH);
                            ctx.lineTo(sr.x + i + 10, sy);
                        }
                    }
                    ctx.fill();
                    ctx.restore();
                }

            } else if (trap.kind === 'bait_orb') {
                if (trap.state === 'gone') continue;
                const r = trap.rect;
                const pulse = Math.sin(trap.pulse) * 0.35 + 0.65;
                ctx.save();
                ctx.shadowBlur = 16 * pulse; ctx.shadowColor = '#ccff00';
                ctx.fillStyle = `rgba(188,255,0,${pulse})`;
                ctx.strokeStyle = '#ccff00'; ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, 0, Math.PI * 2);
                ctx.fill(); ctx.stroke();
                // Tiny "?" to hint something's off — most players ignore it
                ctx.fillStyle = 'rgba(0,0,0,0.8)';
                ctx.font = 'bold 10px monospace';
                ctx.fillText('?', r.x + 8, r.y + 17);
                ctx.restore();

            } else if (trap.kind === 'invert_button') {
                if (trap.triggered) continue;
                const r = trap.rect;
                const pulse = Math.sin(trap.pulse * 1.4) * 0.35 + 0.65;
                ctx.save();
                ctx.shadowBlur = 14 * pulse; ctx.shadowColor = '#ff00ff';
                ctx.fillStyle = `rgba(220,0,255,${pulse})`;
                ctx.strokeStyle = '#ff44ff'; ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, 0, Math.PI * 2);
                ctx.fill(); ctx.stroke();
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 12px monospace';
                ctx.fillText('⟳', r.x + 3, r.y + 17);
                ctx.restore();

            } else if (trap.kind === 'crush_wall') {
                const r = trap.rect;
                if (r.x < -60 || r.x > 870) continue;
                ctx.save();
                const rushing = trap.state === 'rushing';
                ctx.fillStyle = rushing ? '#2a0808' : '#180a1a';
                ctx.strokeStyle = rushing ? '#ff0000' : '#ff4400';
                ctx.lineWidth = 3;
                ctx.shadowBlur = rushing ? 24 : 8; ctx.shadowColor = '#ff2200';
                ctx.fillRect(r.x, r.y, r.w, r.h);
                ctx.strokeRect(r.x, r.y, r.w, r.h);
                // Hazard diagonal stripes
                ctx.globalAlpha = 0.45; ctx.fillStyle = '#ff6600';
                ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
                for (let s = -r.h; s < r.w + r.h; s += 14) ctx.fillRect(r.x + s, r.y, 6, r.h * 2);
                ctx.restore(); ctx.restore();

            } else if (trap.kind === 'fake_floor') {
                const r = trap.rect;
                const danger = Math.min(1, (trap.contactTimer || 0) / trap.killDelay);
                const flicker = trap.flashTimer && (trap.flashTimer % 6 < 3) ? 0.5 : 1;
                // Bleeds from cyan → red as the timer fills
                const red = Math.round(255 * danger);
                const blue = Math.round(255 * (1 - danger));
                ctx.save();
                ctx.globalAlpha = flicker;
                ctx.fillStyle = `rgba(${red},0,${blue},0.45)`;
                ctx.strokeStyle = trap.state === 'lethal' ? '#ff0000' : `rgb(${red},0,${blue})`;
                ctx.lineWidth = 2;
                if (trap.state === 'lethal') { ctx.shadowBlur = 16; ctx.shadowColor = '#ff0000'; }
                ctx.fillRect(r.x, r.y, r.w, r.h);
                ctx.strokeRect(r.x, r.y, r.w, r.h);
                ctx.restore();
            }
        }
    }

    get allSolids() {
        return [
            ...this.platforms,
            ...this.movingPlatforms,
            ...this.crushers.map(c => ({ x: c.x, y: c.y, w: c.w, h: c.h })),
            ...this.disappearingPlatforms.filter(p => p.state !== 'gone').map(p => ({ ...p })),
        ];
    }
}
