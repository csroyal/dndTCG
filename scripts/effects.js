/* ============================================================
   CARD EFFECTS — short visual flourishes that play after a card lands in the simulator.

   Which effect a card gets (first match wins):
     1. card.effect in cards.json (manual override, e.g. "fire", "dragon", "hands")
     2. a signature (CARD_FX_SIGNATURES, keyed by card id): every playable Mythic, some Legendaries
     3. a card category (CARD_FX_CATEGORIES): hand cards, Marut pieces, luck, cleaning, draconic
     4. Summons: their creature type (dragon, undead, beast, ...)
     5. an element/theme found in the card's text (fire, cold, healing, time, ...)
     6. non-Summons with a creature type: that type's effect
     7. a default for the card's class
   Legendaries play their effect a notch bigger, with a gold flourish on top.

   Sound: each effect plays assets/sounds/fx/<name>.mp3 if that file exists (see fxSoundName),
   plus a few extra beats inside effects (fx.sound). Missing files are simply skipped.

   Effects never block input: the canvas ignores pointer events and any click skips them.
============================================================ */

const CARD_FX_KEY = 'DND_TCG_CARD_FX';
let cardFxMode = (() => {
    const saved = localStorage.getItem(CARD_FX_KEY);
    return ['full', 'subtle', 'off'].includes(saved) ? saved : 'full';
})();

/* ---------- Engine ---------- */

const FX = {
    canvas: null, ctx: null, W: 0, H: 0,
    items: [], particles: [], timers: [],
    clock: 0, last: 0, raf: null, fade: 1, skipping: false,
    additive: true, // glow blending; off on light boards, where it would wash out to nothing
};
const FX_MAX_PARTICLES = 1400;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const val  = (v) => Array.isArray(v) ? rand(v[0], v[1]) : (typeof v === 'function' ? v() : v);
const rgba = (c, a) => `rgba(${c},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const DEG = Math.PI / 180;

function fxEnsureCanvas() {
    if (FX.canvas) return;
    const c = document.createElement('canvas');
    c.className = 'card-fx-canvas';
    document.body.append(c);
    FX.canvas = c;
    FX.ctx = c.getContext('2d');
    fxResize();
}

function fxResize() {
    if (!FX.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    FX.W = window.innerWidth;
    FX.H = window.innerHeight;
    FX.canvas.width = Math.round(FX.W * dpr);
    FX.canvas.height = Math.round(FX.H * dpr);
    FX.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', fxResize);

function boardIsDark() {
    const sim = document.getElementById('simulatorSection');
    return document.body.classList.contains('dark-mode') || /sim-bg-/.test(sim?.className || '');
}

function fxStart() {
    fxEnsureCanvas();
    FX.fade = 1;
    FX.skipping = false;
    FX.additive = boardIsDark();
    if (!FX.raf) {
        FX.last = performance.now();
        FX.raf = requestAnimationFrame(fxTick);
    }
}

function fxStop() {
    if (FX.raf) cancelAnimationFrame(FX.raf);
    FX.raf = null;
    FX.items = []; FX.particles = []; FX.timers = [];
    FX.canvas?.remove();
    FX.canvas = null;
}

// Any click/tap skips running effects (quick fade) without stopping the click itself.
document.addEventListener('pointerdown', () => {
    if (FX.raf && !FX.skipping) { FX.skipping = true; FX.timers = []; }
}, true);

function fxTick(now) {
    const dt = Math.min(50, now - FX.last);
    FX.last = now;
    FX.clock += dt;
    const ctx = FX.ctx;

    for (let i = FX.timers.length - 1; i >= 0; i--) {
        if (FX.clock >= FX.timers[i].at) {
            const t = FX.timers.splice(i, 1)[0];
            t.fn();
        }
    }
    if (FX.skipping) {
        FX.fade -= dt / 220;
        if (FX.fade <= 0) { fxStop(); return; }
    }

    ctx.clearRect(0, 0, FX.W, FX.H);

    // draw in the order items were added so later layers sit on top
    FX.items = FX.items.filter(it => FX.clock - it.start < it.dur);
    for (const it of FX.items) {
        const local = FX.clock - it.start;
        if (local < 0) continue;
        ctx.save();
        ctx.globalAlpha = FX.fade;
        ctx.globalCompositeOperation = it.blend === 'lighter' && !FX.additive ? 'source-over' : (it.blend || 'lighter');
        it.draw(ctx, local / it.dur);
        ctx.restore();
    }

    const k = dt / 16.67;
    for (let i = FX.particles.length - 1; i >= 0; i--) {
        const p = FX.particles[i];
        if (p.delay > 0) { p.delay -= dt; continue; }
        p.life += dt;
        if (p.life >= p.max) { FX.particles.splice(i, 1); continue; }
        p.vx += p.ax * k; p.vy += p.ay * k;
        const drag = Math.pow(p.drag, k);
        p.vx *= drag; p.vy *= drag;
        p.x += p.vx * k; p.y += p.vy * k;
        if (p.wobble) p.x += Math.sin(p.life * 0.006 * p.wobFreq + p.phase) * p.wobble * k;
        p.rot += p.vr * k;
        drawParticle(ctx, p);
    }

    if (!FX.items.length && !FX.particles.length && !FX.timers.length) { fxStop(); return; }
    FX.raf = requestAnimationFrame(fxTick);
}

function makeParticle(o) {
    const angle = val(o.angle ?? [0, 360]) * DEG;
    const speed = val(o.speed ?? [1, 3]);
    return {
        x: val(o.x) + (o.spreadX ? rand(-1, 1) * val(o.spreadX) : 0),
        y: val(o.y) + (o.spreadY ? rand(-1, 1) * val(o.spreadY) : 0),
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        ax: val(o.ax ?? 0), ay: val(o.ay ?? 0),
        drag: o.drag ?? 0.97,
        life: 0, max: val(o.life ?? [500, 900]), delay: val(o.delay ?? 0),
        size: val(o.size ?? [2, 5]), grow: o.grow ?? 0,
        color: o.colors ? pick(o.colors) : (o.color || '255,255,255'),
        alpha: val(o.alpha ?? 1), fadeIn: o.fadeIn ?? 0.08, fadePow: o.fadePow ?? 1.4,
        shape: o.shape || 'dot',
        rot: val(o.rot ?? [0, 360]) * DEG, vr: val(o.spin ?? 0) * DEG,
        wobble: o.wobble || 0, wobFreq: val(o.wobFreq ?? 1), phase: rand(0, Math.PI * 2),
        len: o.len ?? 3,
    };
}

function drawParticle(ctx, p) {
    const t = p.life / p.max;
    const a = p.alpha * FX.fade * (t < p.fadeIn ? t / p.fadeIn : 1) * Math.pow(1 - t, p.fadePow);
    if (a <= 0.003) return;
    const s = Math.max(0.3, p.size * (1 + p.grow * t));
    ctx.globalCompositeOperation = p.shape === 'smoke' || !FX.additive ? 'source-over' : 'lighter';

    switch (p.shape) {
        case 'dot':
            ctx.fillStyle = rgba(p.color, a * 0.22);
            ctx.beginPath(); ctx.arc(p.x, p.y, s * 2.4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = rgba(p.color, a);
            ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill();
            break;
        case 'spark': {
            ctx.strokeStyle = rgba(p.color, a);
            ctx.lineWidth = Math.max(0.6, s * 0.5);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * p.len, p.y - p.vy * p.len);
            ctx.stroke();
            break;
        }
        case 'streak':
            ctx.strokeStyle = rgba(p.color, a);
            ctx.lineWidth = Math.max(0.8, s * 0.35);
            ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + s * 7); ctx.stroke();
            break;
        case 'shard':
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
            ctx.fillStyle = rgba(p.color, a);
            ctx.beginPath(); ctx.moveTo(0, -s * 1.8); ctx.lineTo(s * 0.55, 0); ctx.lineTo(0, s * 1.8); ctx.lineTo(-s * 0.55, 0); ctx.closePath(); ctx.fill();
            ctx.restore();
            break;
        case 'petal':
        case 'leaf':
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
            ctx.fillStyle = rgba(p.color, a);
            ctx.beginPath(); ctx.ellipse(0, 0, s, s * (p.shape === 'leaf' ? 0.42 : 0.58), 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            break;
        case 'smoke': {
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
            g.addColorStop(0, rgba(p.color, a * 0.5));
            g.addColorStop(1, rgba(p.color, 0));
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'bubble':
            ctx.strokeStyle = rgba(p.color, a);
            ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = rgba('255,255,255', a * 0.6);
            ctx.beginPath(); ctx.arc(p.x - s * 0.35, p.y - s * 0.35, s * 0.22, 0, Math.PI * 2); ctx.fill();
            break;
        case 'star':
            drawStar(ctx, p.x, p.y, s * 2.2, p.color, a);
            break;
        case 'cross':
            ctx.fillStyle = rgba(p.color, a);
            ctx.fillRect(p.x - s * 0.3, p.y - s, s * 0.6, s * 2);
            ctx.fillRect(p.x - s, p.y - s * 0.3, s * 2, s * 0.6);
            break;
        case 'rock':
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = rgba(p.color, a);
            ctx.beginPath(); ctx.moveTo(-s, -s * 0.6); ctx.lineTo(s * 0.8, -s); ctx.lineTo(s, s * 0.5); ctx.lineTo(-s * 0.4, s); ctx.closePath(); ctx.fill();
            ctx.restore();
            break;
    }
}

// Four-point twinkle.
function drawStar(ctx, x, y, r, color, a) {
    ctx.fillStyle = rgba(color, a);
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r * 0.28, y);
    ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r * 0.28, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.moveTo(x - r, y); ctx.quadraticCurveTo(x, y, x, y + r * 0.28);
    ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y - r * 0.28);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.fill();
    ctx.fillStyle = rgba('255,255,255', a * 0.9);
    ctx.beginPath(); ctx.arc(x, y, r * 0.12, 0, Math.PI * 2); ctx.fill();
}

function jaggedPath(x1, y1, x2, y2, segs, jitter) {
    const pts = [[x1, y1]];
    const nx = -(y2 - y1), ny = x2 - x1;
    const nl = Math.hypot(nx, ny) || 1;
    for (let i = 1; i < segs; i++) {
        const t = i / segs, off = rand(-1, 1) * jitter;
        pts.push([x1 + (x2 - x1) * t + nx / nl * off, y1 + (y2 - y1) * t + ny / nl * off]);
    }
    pts.push([x2, y2]);
    return pts;
}

function strokePts(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
}

function fxShake(px, ms) {
    const el = document.getElementById('simulatorSection');
    if (!el || !el.classList.contains('active') || prefersReducedMotion.matches) return;
    const frames = [];
    const steps = 9;
    for (let i = 0; i <= steps; i++) {
        const d = (1 - i / steps) * px;
        frames.push({ transform: i === steps ? 'translate(0,0)' : `translate(${rand(-d, d).toFixed(1)}px, ${rand(-d, d).toFixed(1)}px)` });
    }
    el.animate(frames, { duration: ms, easing: 'ease-out' });
}

/* ---------- Optional sound ---------- */

// name -> true (file exists) | false (missing) | 'pending' (being checked)
const fxSoundState = {};

function playFxSound(name) {
    if (!name) return;
    const state = fxSoundState[name];
    if (state === true) { playSound(`fx/${name}`); return; }
    if (state !== undefined) return;
    fxSoundState[name] = 'pending';
    const asked = performance.now();
    fetch(`./assets/sounds/fx/${name}.mp3`, { method: 'HEAD' })
        .then(res => {
            fxSoundState[name] = res.ok;
            if (res.ok && performance.now() - asked < 250) playSound(`fx/${name}`); // still in time for this beat
        })
        .catch(() => { fxSoundState[name] = false; });
}

/* ---------- The api handed to each effect ---------- */

function rectInfo(r) {
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

function makeFxApi(origin, board, { intensity, subtle }) {
    const I = intensity;
    const add = (item, delay = 0) => FX.items.push({ ...item, start: FX.clock + delay });
    const api = {
        card: origin, board, I, subtle,
        W: FX.W, H: FX.H,
        rand, pick,
        at(ms, fn) { FX.timers.push({ at: FX.clock + ms, fn }); },
        sound(name, ms = 0) { api.at(ms, () => playFxSound(name)); },
        // calls fn(progress) every `step` ms for `dur` ms
        every(step, dur, fn) { for (let t = 0; t <= dur; t += step) api.at(t, () => fn(t / dur)); },
        emit(n, o) {
            const count = Math.max(1, Math.round(n * I));
            for (let i = 0; i < count && FX.particles.length < FX_MAX_PARTICLES; i++) FX.particles.push(makeParticle(o));
        },
        shake(px, ms = 450) { if (!subtle) fxShake(px * Math.min(I, 1.4), ms); },
        draw(dur, fn, delay = 0, blend = 'lighter') { add({ dur, draw: fn, blend }, delay); },
        ring({ x, y, r0 = 10, r1 = 200, dur = 600, color = '255,255,255', width = 3, alpha = 0.8, delay = 0 }) {
            api.draw(dur, (ctx, p) => {
                const e = easeOut(p);
                ctx.strokeStyle = rgba(color, alpha * (1 - p) * Math.min(1, I));
                ctx.lineWidth = width * (1 - p * 0.6);
                ctx.beginPath(); ctx.arc(x, y, r0 + (r1 - r0) * e, 0, Math.PI * 2); ctx.stroke();
            }, delay);
        },
        flash({ x, y, r = 300, color = '255,255,255', alpha = 0.5, dur = 400, delay = 0 }) {
            const peak = alpha * (subtle ? 0.5 : 1);
            api.draw(dur, (ctx, p) => {
                const a = peak * (p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85);
                const g = ctx.createRadialGradient(x, y, 0, x, y, r);
                g.addColorStop(0, rgba(color, a));
                g.addColorStop(1, rgba(color, 0));
                ctx.fillStyle = g;
                ctx.fillRect(x - r, y - r, r * 2, r * 2);
            }, delay);
        },
        vignette({ color = '0,0,0', alpha = 0.3, dur = 900, delay = 0 }) {
            if (subtle) return;
            api.draw(dur, (ctx, p) => {
                const a = alpha * Math.sin(Math.PI * p);
                const g = ctx.createRadialGradient(FX.W / 2, FX.H / 2, Math.min(FX.W, FX.H) * 0.25, FX.W / 2, FX.H / 2, Math.max(FX.W, FX.H) * 0.75);
                g.addColorStop(0, rgba(color, 0));
                g.addColorStop(1, rgba(color, a));
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, FX.W, FX.H);
            }, delay, 'source-over');
        },
        slash({ x1, y1, x2, y2, dur = 520, color = '255,240,220', width = 5, delay = 0 }) {
            api.draw(dur, (ctx, p) => {
                const grow = Math.min(1, p / 0.28);
                const a = p < 0.28 ? 1 : 1 - (p - 0.28) / 0.72;
                const hx = x1 + (x2 - x1) * easeOut(grow), hy = y1 + (y2 - y1) * easeOut(grow);
                ctx.lineCap = 'round';
                ctx.strokeStyle = rgba(color, a * 0.35);
                ctx.lineWidth = width * 3;
                ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(hx, hy); ctx.stroke();
                ctx.strokeStyle = rgba('255,255,255', a);
                ctx.lineWidth = width * (1 - p * 0.5);
                ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(hx, hy); ctx.stroke();
            }, delay);
        },
        bolt({ x1, y1, x2, y2, dur = 260, color = '170,200,255', delay = 0, segs = 12, jitter = 26 }) {
            let pts = jaggedPath(x1, y1, x2, y2, segs, jitter), tick = 0;
            api.draw(dur, (ctx, p) => {
                if (++tick % 3 === 0) pts = jaggedPath(x1, y1, x2, y2, segs, jitter);
                const a = p < 0.1 ? p / 0.1 : 1 - (p - 0.1) / 0.9;
                ctx.lineJoin = 'round';
                ctx.strokeStyle = rgba(color, a * 0.4); ctx.lineWidth = 8; strokePts(ctx, pts);
                ctx.strokeStyle = rgba('245,248,255', a); ctx.lineWidth = 2; strokePts(ctx, pts);
            }, delay);
        },
        beam({ x, top = 0, bottom, width = 90, color = '255,225,150', dur = 900, delay = 0 }) {
            api.draw(dur, (ctx, p) => {
                const a = Math.sin(Math.PI * p);
                const w = width * (0.4 + 0.6 * easeOut(Math.min(1, p * 2)));
                const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
                g.addColorStop(0, rgba(color, 0));
                g.addColorStop(0.5, rgba(color, a * 0.55));
                g.addColorStop(1, rgba(color, 0));
                ctx.fillStyle = g;
                ctx.fillRect(x - w / 2, top, w, bottom - top);
                ctx.fillStyle = rgba('255,255,255', a * 0.6);
                ctx.fillRect(x - w * 0.03, top, w * 0.06, bottom - top);
            }, delay);
        },
        glint({ x, y, size = 22, color = '255,240,200', dur = 600, delay = 0 }) {
            api.draw(dur, (ctx, p) => {
                const a = Math.sin(Math.PI * p);
                ctx.save(); ctx.translate(x, y); ctx.rotate(p * 0.8);
                drawStar(ctx, 0, 0, size * (0.5 + 0.5 * a), color, a);
                ctx.restore();
            }, delay);
        },
    };
    return api;
}

/* ---------- Shared palettes ---------- */

const PAL = {
    fire:      ['255,200,90', '255,140,50', '255,235,170', '255,100,40'],
    cold:      ['180,225,255', '225,245,255', '130,190,255'],
    lightning: ['185,205,255', '235,240,255', '140,170,255'],
    acid:      ['170,255,90', '110,230,70', '210,255,150'],
    poison:    ['150,230,90', '110,200,80', '190,240,120'],
    necrotic:  ['150,90,200', '90,60,140', '160,255,170'],
    radiant:   ['255,230,150', '255,250,215', '255,205,100'],
    psychic:   ['255,130,220', '190,120,255', '255,190,240'],
    force:     ['190,160,255', '235,225,255', '150,120,255'],
    healing:   ['140,255,170', '220,255,200', '255,240,170'],
    gold:      ['255,215,110', '255,240,190', '255,190,70'],
};
const BREATH = {
    fire:      ['255,150,50', '255,110,35', '255,190,90', '240,80,30'],
    cold:      ['150,205,255', '190,225,255', '110,170,255'],
    lightning: ['150,175,255', '200,215,255', '120,150,255'],
    acid:      ['140,235,70', '100,210,60', '180,245,110'],
    poison:    ['130,210,80', '100,180,70', '160,225,100'],
    gold:      ['255,205,90', '255,230,150', '255,180,60', '255,245,200'],
};

// A cone of breath from (x, y) at angle a (degrees); shared by the Dragon effect and Hydra.
function emitBreath(fx, x, y, a, palette, smoke, reach = 1) {
    const ox = x + Math.cos(a * DEG) * 26, oy = y + Math.sin(a * DEG) * 26;
    fx.emit(4, { x: ox, y: oy, angle: [a - 8, a + 8], speed: [9 * reach, 15 * reach], drag: 0.98, life: [650, 950],
        size: [5, 10], grow: 2.2, alpha: 0.7, colors: palette });
    fx.emit(1, { x: ox, y: oy, angle: [a - 11, a + 11], speed: [5 * reach, 8 * reach], drag: 0.97, life: [750, 1050],
        size: [16, 26], grow: 2, shape: 'smoke', color: smoke, alpha: 0.45 });
}

/* ---------- Creature-type effects (Summons) ---------- */

const CARD_FX_TYPES = {
    // Roar shockwaves, a shake, then a breath sweep across the board (colour follows the card's element).
    dragon(fx, { element } = {}) {
        const { card } = fx;
        const breath = BREATH[element] || BREATH.fire;
        const smoke = element === 'cold' ? '200,220,240' : element === 'acid' || element === 'poison' ? '90,120,60'
                    : element === 'gold' ? '120,95,50' : '60,45,35';
        const ringColor = element === 'gold' ? '255,220,140' : '255,255,255';
        fx.vignette({ alpha: 0.32, dur: 1300 });
        for (let i = 0; i < 3; i++) fx.ring({ x: card.x, y: card.y, r0: card.w * 0.4, r1: Math.max(fx.W, fx.H) * 0.55, dur: 750, width: 4, alpha: 0.55, color: ringColor, delay: i * 130 });
        fx.sound('breath', 260);
        fx.shake(11, 620);
        fx.every(16, 760, (p) => {
            const a = 160 - 140 * easeInOut(p); // sweep from lower-left to lower-right
            fx.at(260, () => emitBreath(fx, card.x, card.y + card.h * 0.2, a, breath, smoke));
        });
        fx.flash({ x: card.x, y: card.y + card.h * 0.3, r: 340, color: breath[1], alpha: 0.35, dur: 800, delay: 260 });
    },

    // Ghostly wisps drift up through low green mist.
    undead(fx) {
        const { card } = fx;
        fx.vignette({ color: '10,30,20', alpha: 0.35, dur: 1500 });
        fx.emit(16, { x: card.x, y: card.bottom, spreadX: card.w * 1.2, spreadY: 14, speed: [0.3, 0.8], angle: [180, 360], life: [1300, 1700], size: [36, 60],
            grow: 1.3, shape: 'smoke', color: '110,170,140', alpha: 0.6, fadeIn: 0.3 });
        fx.emit(32, { x: card.x, y: card.y + card.h * 0.3, spreadX: card.w * 0.8, spreadY: card.h * 0.2, angle: [262, 278], speed: [1, 2.2], drag: 0.99,
            life: [1200, 1700], size: [3.5, 7], colors: ['170,255,220', '120,230,200', '210,255,240'], wobble: 1, wobFreq: [0.6, 1.2], fadeIn: 0.25, delay: [0, 500] });
        fx.flash({ x: card.x, y: card.y, r: 240, color: '120,255,200', alpha: 0.22, dur: 1100 });
        fx.ring({ x: card.x, y: card.y, r0: card.w * 0.3, r1: card.w * 1.6, dur: 1000, color: '150,255,210', width: 2, alpha: 0.45 });
    },

    // Three claw marks rake across the card.
    beast(fx) {
        const { card } = fx;
        fx.shake(5, 300);
        for (let i = 0; i < 3; i++) {
            const off = (i - 1) * card.w * 0.24;
            const x1 = card.x - card.w * 0.55 + off, y1 = card.y - card.h * 0.5, x2 = card.x + card.w * 0.35 + off, y2 = card.y + card.h * 0.5;
            fx.slash({ x1, y1, x2, y2, width: 5, color: '255,170,110', delay: i * 70 });
            fx.at(i * 70 + 90, () => fx.emit(7, { x: (x1 + x2) / 2, y: (y1 + y2) / 2, spreadX: card.w * 0.3, spreadY: card.h * 0.3,
                angle: [20, 70], speed: [3, 6], life: [300, 500], size: [2, 3.5], shape: 'spark', colors: ['255,220,180', '255,170,110'] }));
        }
        fx.emit(8, { x: card.x, y: card.bottom, spreadX: card.w * 0.6, angle: [200, 340], speed: [1, 2.5], life: [700, 1000], size: [14, 22],
            grow: 1.3, shape: 'smoke', color: '150,120,90', alpha: 0.35, delay: 120 });
    },

    // Spinning gears, a fountain of sparks, and a puff of steam.
    machine(fx, { gearColor = '255,215,140', sparks = ['255,230,150', '255,200,90', '255,255,230'] } = {}) {
        const { card } = fx;
        fx.shake(4, 280);
        const gears = [[-0.55, -0.15, 0.32, 1], [0.6, 0.1, 0.26, -1.4], [-0.1, 0.62, 0.2, 1.8]];
        gears.forEach(([gx, gy, gr, dir], i) => {
            const x = card.x + gx * card.w, y = card.y + gy * card.h, r = gr * card.w;
            fx.draw(1100, (ctx, p) => {
                const a = Math.sin(Math.PI * p) * 0.75;
                ctx.save(); ctx.translate(x, y); ctx.rotate(dir * p * 2.4);
                ctx.strokeStyle = rgba(gearColor, a); ctx.lineWidth = 2;
                ctx.beginPath();
                for (let t = 0; t < 12; t++) {
                    const a0 = (t / 12) * Math.PI * 2, a1 = a0 + Math.PI / 12;
                    ctx.arc(0, 0, r, a0, a0 + Math.PI / 24);
                    ctx.lineTo(Math.cos(a0 + Math.PI / 24) * r * 1.25, Math.sin(a0 + Math.PI / 24) * r * 1.25);
                    ctx.arc(0, 0, r * 1.25, a0 + Math.PI / 24, a1);
                    ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
                }
                ctx.stroke();
                ctx.beginPath(); ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2); ctx.stroke();
                ctx.restore();
            }, i * 90);
        });
        fx.emit(40, { x: card.x, y: card.top + card.h * 0.15, spreadX: card.w * 0.3, angle: [230, 310], speed: [5, 10], ay: 0.32, drag: 0.985,
            life: [500, 850], size: [2, 3.5], shape: 'spark', colors: sparks, len: 2.4 });
        fx.emit(7, { x: card.x, y: card.top, spreadX: card.w * 0.4, angle: [255, 285], speed: [1, 2], life: [900, 1300], size: [16, 26],
            grow: 1.5, shape: 'smoke', color: '220,220,225', alpha: 0.3, delay: 150 });
    },

    // Petals and twinkles spiral out around the card.
    fey(fx) {
        const { card } = fx;
        fx.emit(36, { x: card.x, y: card.y, spreadX: card.w * 0.3, spreadY: card.h * 0.3, speed: [1.5, 4], drag: 0.97, ay: 0.02, life: [1100, 1600],
            size: [4, 7], shape: 'petal', spin: [-6, 6], colors: ['255,190,220', '200,170,255', '170,240,230', '255,240,200'], fadeIn: 0.15 });
        fx.emit(16, { x: card.x, y: card.y, spreadX: card.w, spreadY: card.h * 0.8, speed: [0, 0.4], life: [600, 1100], size: [3, 6],
            shape: 'star', colors: ['255,240,250', '220,240,255'], delay: [0, 700], fadeIn: 0.4 });
        fx.ring({ x: card.x, y: card.y, r0: card.w * 0.3, r1: card.w * 1.4, dur: 900, color: '230,200,255', width: 2, alpha: 0.5 });
    },

    // Hellfire rises from below; a rotating sigil flares and fades.
    fiend(fx) {
        const { card } = fx;
        fx.vignette({ color: '40,0,0', alpha: 0.35, dur: 1300 });
        fx.shake(5, 400);
        fx.flash({ x: card.x, y: card.bottom, r: 280, color: '255,60,30', alpha: 0.4, dur: 900 });
        fx.every(30, 700, () => fx.emit(3, { x: card.x, y: card.bottom, spreadX: card.w * 0.6, angle: [255, 285], speed: [2.5, 5], drag: 0.975,
            life: [600, 1000], size: [2.5, 6], colors: ['255,90,40', '255,150,60', '200,60,255'], wobble: 0.4 }));
        fx.draw(1200, (ctx, p) => {
            const a = Math.sin(Math.PI * p) * 0.7, r = card.w * (0.75 + 0.15 * p);
            ctx.save(); ctx.translate(card.x, card.y + card.h * 0.05); ctx.rotate(p * 1.2);
            ctx.strokeStyle = rgba('255,80,50', a); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath();
            for (let i = 0; i <= 5; i++) {
                const ang = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
                const px = Math.cos(ang) * r * 0.92, py = Math.sin(ang) * r * 0.92;
                i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
            }
            ctx.stroke();
            ctx.restore();
        });
    },

    // Vines curl out from the card and leaves drift down.
    plant(fx) {
        const { card } = fx;
        for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2 + rand(-0.3, 0.3);
            const len = card.w * rand(0.9, 1.4), curl = rand(-1, 1) * card.w * 0.5;
            const sx = card.x + Math.cos(ang) * card.w * 0.35, sy = card.y + Math.sin(ang) * card.h * 0.35;
            const ex = sx + Math.cos(ang) * len, ey = sy + Math.sin(ang) * len;
            const cx = (sx + ex) / 2 + Math.cos(ang + Math.PI / 2) * curl, cy = (sy + ey) / 2 + Math.sin(ang + Math.PI / 2) * curl;
            fx.draw(1300, (ctx, p) => {
                const g = easeOut(Math.min(1, p / 0.5)), a = p < 0.6 ? 0.85 : 0.85 * (1 - (p - 0.6) / 0.4);
                ctx.strokeStyle = rgba('120,210,110', a); ctx.lineWidth = 3; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(sx, sy);
                const steps = 18;
                for (let s = 1; s <= Math.round(steps * g); s++) {
                    const t = s / steps;
                    ctx.lineTo((1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * ex, (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ey);
                }
                ctx.stroke();
            }, i * 50, 'source-over');
        }
        fx.emit(22, { x: card.x, y: card.y, spreadX: card.w * 0.8, spreadY: card.h * 0.5, speed: [0.5, 2], ay: 0.04, drag: 0.98, life: [1100, 1500],
            size: [4, 7], shape: 'leaf', spin: [-4, 4], colors: ['130,210,100', '170,230,120', '100,180,90'], wobble: 0.6, delay: [150, 600] });
    },

    // Particles are drawn into a pair of spinning rune rings, then burst.
    entity(fx) {
        const { card } = fx;
        const R = card.w * 1.1;
        fx.emit(30, { x: () => card.x + Math.cos(rand(0, 6.28)) * R, y: card.y, spreadY: R, speed: 0, life: [380, 460], size: [2, 3.5],
            colors: PAL.force, fadeIn: 0.6 });
        FX.particles.slice(-Math.round(30 * fx.I)).forEach(p => { p.vx = (card.x - p.x) / 22; p.vy = (card.y - p.y) / 22; p.drag = 1; });
        for (const [dir, rr] of [[1, 0.95], [-1, 0.7]]) {
            fx.draw(1100, (ctx, p) => {
                const a = Math.sin(Math.PI * p) * 0.7, r = card.w * rr * (0.9 + 0.1 * p);
                ctx.save(); ctx.translate(card.x, card.y); ctx.rotate(dir * p * 2);
                ctx.strokeStyle = rgba('190,160,255', a); ctx.lineWidth = 1.6;
                ctx.setLineDash([10, 7]);
                ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]);
                for (let i = 0; i < 8; i++) {
                    ctx.rotate(Math.PI / 4);
                    ctx.beginPath(); ctx.moveTo(r - 5, 0); ctx.lineTo(r + 5, 0); ctx.stroke();
                }
                ctx.restore();
            });
        }
        fx.at(420, () => {
            fx.flash({ x: card.x, y: card.y, r: 220, color: '170,130,255', alpha: 0.45, dur: 500 });
            fx.emit(34, { x: card.x, y: card.y, speed: [3, 7], drag: 0.94, life: [500, 800], size: [2, 4], colors: PAL.force });
        });
    },

    // A heroic glint: rising light streaks, a sheen across the card, and a star sparkle.
    humanoid(fx) {
        const { card } = fx;
        fx.emit(18, { x: card.x, y: card.bottom, spreadX: card.w * 0.55, angle: [266, 274], speed: [3, 5], drag: 0.98, life: [600, 900], size: [3, 5],
            shape: 'streak', colors: PAL.gold, delay: [0, 250] });
        fx.draw(650, (ctx, p) => {
            ctx.save();
            ctx.beginPath(); ctx.rect(card.left, card.top, card.w, card.h); ctx.clip();
            const x = card.left - card.w + (card.w * 3) * easeInOut(p);
            const g = ctx.createLinearGradient(x - 40, 0, x + 40, 0);
            g.addColorStop(0, rgba('255,255,255', 0)); g.addColorStop(0.5, rgba('255,250,230', 0.55)); g.addColorStop(1, rgba('255,255,255', 0));
            ctx.fillStyle = g;
            ctx.translate(0, 0);
            ctx.fillRect(card.left - card.w, card.top, card.w * 3, card.h);
            ctx.restore();
        }, 120);
        fx.glint({ x: card.right - card.w * 0.15, y: card.top + card.h * 0.12, size: 26, delay: 380 });
        fx.emit(14, { x: card.x, y: card.y, spreadX: card.w * 0.6, spreadY: card.h * 0.6, speed: [0.3, 1], life: [500, 900], size: [2, 4], shape: 'star',
            colors: PAL.gold, delay: [200, 600] });
    },
};

/* ---------- Element / theme effects (mostly Spells and Utility, aimed at the board) ---------- */

const CARD_FX_ELEMENTS = {
    fire(fx) {
        const { board: b } = fx;
        fx.flash({ x: b.x, y: b.y, r: 340, color: '255,150,60', alpha: 0.5, dur: 700 });
        fx.ring({ x: b.x, y: b.y, r0: 20, r1: 260, dur: 600, color: '255,190,110', width: 4 });
        fx.shake(6, 380);
        fx.emit(70, { x: b.x, y: b.y, speed: [3, 9], drag: 0.93, ay: -0.03, life: [600, 1000], size: [3, 8], grow: 0.6, colors: PAL.fire });
        fx.emit(10, { x: b.x, y: b.y, spreadX: 40, spreadY: 30, speed: [0.5, 2], angle: [240, 300], life: [900, 1300], size: [30, 50],
            grow: 1.2, shape: 'smoke', color: '70,50,40', alpha: 0.45, delay: 150 });
    },
    cold(fx) {
        const { board: b } = fx;
        fx.flash({ x: b.x, y: b.y, r: 300, color: '200,235,255', alpha: 0.45, dur: 600 });
        fx.ring({ x: b.x, y: b.y, r0: 20, r1: 240, dur: 650, color: '220,240,255', width: 3 });
        fx.emit(28, { x: b.x, y: b.y, speed: [6, 11], drag: 0.9, life: [500, 800], size: [4, 7], shape: 'shard', colors: PAL.cold, fadePow: 2 });
        fx.emit(36, { x: b.x, y: b.top, spreadX: b.w * 0.5, angle: [80, 100], speed: [0.6, 1.4], drag: 1, life: [1100, 1600], size: [1.5, 3],
            colors: ['235,245,255'], wobble: 0.5, delay: [0, 500] });
    },
    lightning(fx) {
        const { board: b } = fx;
        for (let i = 0; i < 3; i++) {
            const tx = b.x + rand(-b.w * 0.25, b.w * 0.25), ty = b.y + rand(-b.h * 0.15, b.h * 0.15);
            fx.bolt({ x1: tx + rand(-120, 120), y1: 0, x2: tx, y2: ty, delay: i * 110 });
            fx.at(i * 110, () => {
                fx.emit(12, { x: tx, y: ty, angle: [200, 340], speed: [3, 7], ay: 0.2, life: [300, 550], size: [1.5, 3], shape: 'spark', colors: PAL.lightning });
                fx.ring({ x: tx, y: ty, r0: 6, r1: 90, dur: 350, color: '200,215,255', width: 2 });
            });
        }
        fx.flash({ x: b.x, y: b.y, r: 420, color: '210,225,255', alpha: 0.45, dur: 420 });
        fx.shake(6, 350);
    },
    force(fx) {
        const { board: b } = fx;
        const from = document.getElementById('simulatorHand')?.getBoundingClientRect();
        const sx = from && from.width ? from.left + from.width / 2 : fx.W / 2, sy = from && from.width ? from.top + 40 : fx.H - 80;
        for (let i = 0; i < 3; i++) {
            const tx = b.x + (i - 1) * b.w * 0.18, ty = b.y + rand(-30, 30);
            const cx = (sx + tx) / 2 + (i - 1) * 160, cy = Math.min(sy, ty) - 120;
            fx.draw(520, (ctx, p) => {
                const t = easeInOut(p);
                const x = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * tx;
                const y = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ty;
                ctx.fillStyle = rgba('200,180,255', 0.35); ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = rgba('250,245,255', 1); ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
                if (Math.random() < 0.9) fx.emit(1, { x, y, speed: [0, 0.6], life: [250, 380], size: [2, 3.5], colors: PAL.force });
            }, i * 90);
            fx.at(i * 90 + 500, () => {
                fx.ring({ x: tx, y: ty, r0: 6, r1: 80, dur: 400, color: '210,190,255', width: 2.5 });
                fx.emit(14, { x: tx, y: ty, speed: [2, 5], drag: 0.93, life: [300, 550], size: [1.5, 3], colors: PAL.force });
            });
        }
    },
    necrotic(fx) {
        const { board: b } = fx;
        fx.vignette({ color: '15,0,25', alpha: 0.45, dur: 1400 });
        const R = Math.min(b.w, 520) * 0.5;
        fx.emit(40, { x: () => b.x + Math.cos(rand(0, 6.28)) * R, y: () => b.y + Math.sin(rand(0, 6.28)) * R * 0.6, speed: 0, life: [700, 900],
            size: [18, 30], shape: 'smoke', color: '60,20,80', alpha: 0.5, fadeIn: 0.3 });
        FX.particles.slice(-Math.round(40 * fx.I)).forEach(p => { p.vx = (b.x - p.x) / 45; p.vy = (b.y - p.y) / 45; p.drag = 1; });
        fx.emit(20, { x: b.x, y: b.y, spreadX: R, spreadY: R * 0.5, speed: [0.3, 1], angle: [250, 290], life: [900, 1300], size: [2, 3.5],
            colors: ['170,255,180', '200,140,255'], delay: [200, 600] });
        fx.at(650, () => fx.flash({ x: b.x, y: b.y, r: 200, color: '150,90,220', alpha: 0.45, dur: 500 }));
    },
    radiant(fx) {
        const { board: b } = fx;
        fx.beam({ x: b.x, top: 0, bottom: b.bottom, width: 120, dur: 1100 });
        fx.flash({ x: b.x, y: b.y, r: 300, color: '255,235,170', alpha: 0.4, dur: 900, delay: 150 });
        fx.ring({ x: b.x, y: b.y, r0: 20, r1: 220, dur: 700, color: '255,240,190', width: 3, delay: 200 });
        fx.emit(30, { x: b.x, y: b.y, spreadX: 80, spreadY: 40, angle: [260, 280], speed: [1, 3], drag: 0.99, life: [900, 1300], size: [2, 4],
            colors: PAL.radiant, delay: [150, 600] });
    },
    poison(fx) {
        const { board: b } = fx;
        fx.emit(10, { x: b.x, y: b.y, spreadX: 120, spreadY: 50, speed: [0.3, 1], life: [1100, 1500], size: [34, 56], grow: 1, shape: 'smoke',
            color: '110,170,70', alpha: 0.4, fadeIn: 0.3 });
        fx.emit(30, { x: b.x, y: b.y + 40, spreadX: 140, spreadY: 30, angle: [262, 278], speed: [1, 2.2], drag: 1, life: [900, 1400], size: [4, 9],
            shape: 'bubble', colors: PAL.poison, wobble: 0.7, delay: [0, 600] });
    },
    thunder(fx) {
        const { board: b } = fx;
        for (let i = 0; i < 3; i++) fx.ring({ x: b.x, y: b.y, r0: 20, r1: Math.max(b.w, 400) * 0.75, dur: 700, color: '210,225,255', width: 6 - i, alpha: 0.7, delay: i * 120 });
        fx.shake(12, 600);
        fx.flash({ x: b.x, y: b.y, r: 380, color: '220,230,255', alpha: 0.35, dur: 500 });
        fx.emit(24, { x: b.x, y: b.bottom, spreadX: b.w * 0.4, angle: [190, 350], speed: [2, 5], drag: 0.95, life: [700, 1000], size: [16, 26],
            grow: 1.2, shape: 'smoke', color: '150,150,160', alpha: 0.3 });
    },
    acid(fx) {
        const { board: b } = fx;
        fx.flash({ x: b.x, y: b.y, r: 240, color: '160,255,90', alpha: 0.35, dur: 500 });
        fx.emit(40, { x: b.x, y: b.y, angle: [200, 340], speed: [4, 9], ay: 0.32, drag: 0.99, life: [700, 1000], size: [3, 6], colors: PAL.acid });
        fx.emit(10, { x: b.x, y: b.y + 30, spreadX: 120, speed: [0.3, 1], angle: [250, 290], life: [800, 1200], size: [16, 26], grow: 1.3,
            shape: 'smoke', color: '190,220,150', alpha: 0.3, delay: 250 });
    },
    psychic(fx) {
        const { board: b } = fx;
        for (let i = 0; i < 5; i++) {
            fx.draw(1000, (ctx, p) => {
                const r = 30 + p * 260, a = (1 - p) * 0.6;
                ctx.strokeStyle = rgba(i % 2 ? '255,140,220' : '190,130,255', a); ctx.lineWidth = 2;
                ctx.beginPath();
                for (let s = 0; s <= 64; s++) {
                    const ang = (s / 64) * Math.PI * 2, wr = r + Math.sin(ang * 6 + p * 12 + i) * 8;
                    const x = b.x + Math.cos(ang) * wr, y = b.y + Math.sin(ang) * wr * 0.7;
                    s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
                }
                ctx.stroke();
            }, i * 120);
        }
        fx.emit(24, { x: b.x, y: b.y, speed: [1, 3], drag: 0.97, life: [800, 1200], size: [2, 4], colors: PAL.psychic, wobble: 0.6 });
    },
    healing(fx) {
        const { board: b } = fx;
        fx.flash({ x: b.x, y: b.y, r: 280, color: '170,255,190', alpha: 0.35, dur: 900 });
        fx.emit(22, { x: b.x, y: b.bottom, spreadX: b.w * 0.35, angle: [262, 278], speed: [1.2, 2.6], drag: 0.995, life: [1000, 1500], size: [4, 7],
            shape: 'cross', colors: PAL.healing, delay: [0, 500] });
        fx.emit(24, { x: b.x, y: b.y, spreadX: b.w * 0.3, spreadY: b.h * 0.3, speed: [0.2, 0.8], life: [700, 1100], size: [2, 3.5], shape: 'star',
            colors: ['230,255,220', '255,245,200'], delay: [100, 700] });
    },
    // A clock face whose hand sweeps round, with time ripples.
    time(fx) {
        const { board: b } = fx;
        const R = Math.min(b.h * 0.42, 150);
        fx.draw(1300, (ctx, p) => {
            const a = Math.sin(Math.PI * p) * 0.75;
            ctx.save(); ctx.translate(b.x, b.y);
            ctx.strokeStyle = rgba('170,210,255', a); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
            for (let i = 0; i < 12; i++) {
                const ang = (i / 12) * Math.PI * 2;
                ctx.beginPath(); ctx.moveTo(Math.cos(ang) * R * 0.86, Math.sin(ang) * R * 0.86); ctx.lineTo(Math.cos(ang) * R, Math.sin(ang) * R); ctx.stroke();
            }
            const hand = -Math.PI / 2 + easeInOut(p) * Math.PI * 2;
            ctx.lineWidth = 3;
            ctx.strokeStyle = rgba('235,245,255', a);
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(hand) * R * 0.78, Math.sin(hand) * R * 0.78); ctx.stroke();
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(hand / 12 - Math.PI / 3) * R * 0.5, Math.sin(hand / 12 - Math.PI / 3) * R * 0.5); ctx.stroke();
            ctx.restore();
        });
        for (let i = 0; i < 3; i++) fx.ring({ x: b.x, y: b.y, r0: R, r1: R * 2.2, dur: 800, color: '170,210,255', width: 2, alpha: 0.5, delay: 300 + i * 220 });
        fx.emit(18, { x: b.x, y: b.y, spreadX: R, spreadY: R, speed: [0.2, 0.6], life: [700, 1100], size: [2, 3], shape: 'star', colors: ['210,230,255'], delay: [100, 800] });
    },
    // Stone shards burst up from the ground with a rumble.
    earth(fx) {
        const { board: b } = fx;
        fx.shake(9, 550);
        fx.emit(34, { x: b.x, y: b.bottom - 10, spreadX: b.w * 0.35, angle: [235, 305], speed: [4, 9], ay: 0.35, drag: 0.99, life: [700, 1000],
            size: [3, 7], shape: 'rock', spin: [-8, 8], colors: ['150,125,100', '120,100,80', '180,160,130'] });
        fx.emit(14, { x: b.x, y: b.bottom, spreadX: b.w * 0.4, angle: [190, 350], speed: [1.5, 3.5], drag: 0.95, life: [900, 1300], size: [20, 34],
            grow: 1.3, shape: 'smoke', color: '150,130,110', alpha: 0.35 });
        fx.draw(900, (ctx, p) => {
            ctx.strokeStyle = rgba('255,190,120', (1 - p) * 0.5); ctx.lineWidth = 2;
            for (let i = 0; i < 5; i++) {
                const ang = Math.PI + (i / 4) * Math.PI;
                const len = 60 + i * 25;
                strokePts(ctx, jaggedPath(b.x, b.bottom - 6, b.x + Math.cos(ang) * len * easeOut(Math.min(1, p * 2)) * 2.4, b.bottom - 6 + Math.sin(ang) * 10, 6, 6));
            }
        }, 0, 'source-over');
    },
    // Defaults for cards with nothing more specific.
    arcane(fx) {
        const { board: b } = fx;
        const R = Math.min(b.h * 0.4, 140);
        fx.draw(1100, (ctx, p) => {
            const s = easeOut(Math.min(1, p * 2.5)), a = p < 0.7 ? 0.75 : 0.75 * (1 - (p - 0.7) / 0.3);
            ctx.save(); ctx.translate(b.x, b.y); ctx.scale(s, s * 0.6); ctx.rotate(p * 1.4);
            ctx.strokeStyle = rgba('170,240,200', a); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(0, 0, R * 0.78, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.rect(-R * 0.55, -R * 0.55, R * 1.1, R * 1.1); ctx.stroke();
            ctx.rotate(Math.PI / 4);
            ctx.beginPath(); ctx.rect(-R * 0.55, -R * 0.55, R * 1.1, R * 1.1); ctx.stroke();
            ctx.restore();
        });
        fx.at(380, () => fx.emit(30, { x: b.x, y: b.y, speed: [2, 5], drag: 0.94, life: [500, 800], size: [2, 3.5], colors: ['190,255,220', '255,255,255'] }));
    },
    utility(fx) {
        const { board: b } = fx;
        fx.ring({ x: b.x, y: b.y, r0: 10, r1: 150, dur: 600, color: '225,230,240', width: 2, alpha: 0.6 });
        fx.emit(22, { x: b.x, y: b.y, spreadX: 70, spreadY: 40, speed: [0.5, 2], life: [500, 900], size: [2, 4], shape: 'star', colors: ['240,245,255', '210,220,235'] });
    },
    // Reaction activated (fallback when its text names no element): the trap springs.
    reaction(fx) {
        const { card } = fx;
        fx.flash({ x: card.x, y: card.y, r: card.w * 2.2, color: '150,195,255', alpha: 0.5, dur: 450 });
        for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
            fx.slash({ x1: card.x + Math.cos(ang) * card.w * 0.45, y1: card.y + Math.sin(ang) * card.w * 0.45,
                x2: card.x + Math.cos(ang) * card.w * 1.5, y2: card.y + Math.sin(ang) * card.w * 1.5, width: 3, dur: 380, color: '170,210,255' });
        }
        fx.ring({ x: card.x, y: card.y, r0: card.w * 0.4, r1: card.w * 2, dur: 550, color: '190,220,255', width: 3 });
        fx.emit(26, { x: card.x, y: card.y, speed: [3, 7], drag: 0.93, life: [400, 700], size: [2, 3.5], colors: ['170,210,255', '235,245,255'] });
        fx.shake(4, 260);
    },
    summon(fx) {
        const { card } = fx;
        fx.ring({ x: card.x, y: card.y, r0: card.w * 0.3, r1: card.w * 1.3, dur: 650, color: '255,250,235', width: 2.5 });
        fx.emit(20, { x: card.x, y: card.y, spreadX: card.w * 0.5, spreadY: card.h * 0.5, speed: [0.4, 1.4], life: [500, 900], size: [2, 3.5], shape: 'star',
            colors: ['255,250,235', '255,235,190'] });
    },
};

/* ---------- Card categories ---------- */

// A cartoon glove, matching the Hands of Time cards. Outline first, fill over it, so only the outer edge shows.
function drawGlove(ctx, x, y, s, rot, a, mirror = false, open = 1) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(mirror ? -s : s, s);
    const parts = (c) => {
        c.beginPath();
        c.roundRect(-0.5, -0.1, 1, 0.85, 0.3);                       // palm
        [[-0.36, 0.5], [-0.12, 0.62], [0.12, 0.6], [0.36, 0.48]].forEach(([fxp, h]) => {
            c.roundRect(fxp - 0.1, -0.1 - h * open, 0.2, h * open + 0.2, 0.1); // fingers
        });
        c.save(); c.translate(-0.48, 0.32); c.rotate(-0.9 * open);
        c.roundRect(-0.11, -0.42, 0.22, 0.5, 0.11);                  // thumb
        c.restore();
        c.roundRect(-0.56, 0.7, 1.12, 0.26, 0.08);                   // cuff
    };
    parts(ctx);
    ctx.lineWidth = 0.07; ctx.lineJoin = 'round';
    ctx.strokeStyle = rgba('45,30,15', a * 0.85); ctx.stroke();
    ctx.fillStyle = rgba('255,251,243', a); ctx.fill();
    ctx.restore();
}

function drawFootprint(ctx, x, y, s, rot, a) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.fillStyle = rgba('255,245,225', a);
    ctx.beginPath(); ctx.ellipse(0, 0.25, 0.32, 0.55, 0, 0, Math.PI * 2); ctx.fill();
    [[-0.26, -0.45, 0.11], [-0.08, -0.55, 0.1], [0.1, -0.52, 0.09], [0.25, -0.42, 0.08], [0.36, -0.28, 0.07]].forEach(([tx, ty, tr]) => {
        ctx.beginPath(); ctx.arc(tx, ty, tr, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
}

function drawD20(ctx, x, y, r, rot, a, face) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const ang = -Math.PI / 2 + (i / 6) * Math.PI * 2;
        i ? ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r) : ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
    }
    ctx.closePath();
    ctx.fillStyle = rgba('70,45,120', a * 0.92); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = rgba('235,215,255', a); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
        const ang = -Math.PI / 2 + (i / 3) * Math.PI * 2;
        i ? ctx.lineTo(Math.cos(ang) * r * 0.62, Math.sin(ang) * r * 0.62) : ctx.moveTo(Math.cos(ang) * r * 0.62, Math.sin(ang) * r * 0.62);
    }
    ctx.closePath(); ctx.lineWidth = 1.2; ctx.stroke();
    ctx.rotate(-rot);
    ctx.fillStyle = rgba(face === 20 ? '255,220,110' : '255,255,255', a);
    ctx.font = `800 ${Math.round(r * 0.55)}px "Nunito Sans", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(face), 0, r * 0.08);
    ctx.restore();
}

const CARD_FX_CATEGORIES = {
    // Hands of Time hand cards: big cartoon gloves, in a few moods.
    hands(fx, { variant = 'clap' } = {}) {
        const { board: b } = fx;
        const s = Math.min(b.h * 0.42, 130);
        if (variant === 'swipe') {
            // a glove sweeps across the board, handing something off
            fx.draw(1000, (ctx, p) => {
                const t = easeInOut(p), a = Math.sin(Math.PI * p);
                const x = b.left - s + (b.w + s * 2) * t, y = b.y + Math.sin(t * Math.PI) * -s * 0.5;
                drawGlove(ctx, x, y, s, 0.35 - t * 0.7, a, false);
                if (Math.random() < 0.8) fx.emit(1, { x: x - s * 0.3, y: y + s * 0.2, speed: [0, 0.6], life: [300, 500], size: [2, 3.5], shape: 'star', colors: ['255,245,215'] });
            }, 0, 'source-over');
            fx.sound('whoosh');
        } else if (variant === 'release') {
            // the glove lets go and floats away with a puff
            fx.draw(1100, (ctx, p) => {
                const a = p < 0.2 ? p / 0.2 : 1 - Math.max(0, (p - 0.45) / 0.55);
                drawGlove(ctx, b.x, b.y + s * 0.2 - easeOut(p) * s * 0.9, s, Math.sin(p * 9) * 0.08, a, false, 0.35 + easeOut(Math.min(1, p * 2)) * 0.65);
            }, 0, 'source-over');
            fx.at(380, () => fx.emit(12, { x: b.x, y: b.y + s * 0.4, speed: [1, 3], drag: 0.94, life: [600, 900], size: [16, 24], grow: 1.2,
                shape: 'smoke', color: '235,230,220', alpha: 0.5 }));
            fx.sound('pop', 380);
        } else if (variant === 'footsteps') {
            // footprints stomp across the board, left, right, left...
            for (let i = 0; i < 6; i++) {
                const t = i / 5, x = b.left + b.w * (0.12 + 0.76 * t), y = b.y + (i % 2 ? s * 0.25 : -s * 0.25);
                fx.draw(900, (ctx, p) => {
                    const a = p < 0.08 ? p / 0.08 : 1 - p;
                    drawFootprint(ctx, x, y, s * 0.5 * (p < 0.08 ? 1.25 - p * 3 : 1), Math.PI / 2 + (i % 2 ? 0.15 : -0.15), a * 0.9);
                }, i * 130, 'source-over');
                fx.at(i * 130, () => fx.emit(4, { x, y: y + s * 0.2, angle: [200, 340], speed: [1, 2.5], life: [400, 600], size: [8, 12], grow: 1,
                    shape: 'smoke', color: '200,190,175', alpha: 0.4 }));
                fx.sound('footstep', i * 130);
            }
            fx.shake(3, 700);
        } else {
            // two gloves meet in the middle: clap!
            fx.draw(900, (ctx, p) => {
                const meet = easeInOut(Math.min(1, p / 0.4)), a = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
                const off = (1 - meet) * b.w * 0.42 + s * 0.38;
                drawGlove(ctx, b.x - off, b.y, s, Math.PI / 2 - 0.15, a, false);
                drawGlove(ctx, b.x + off, b.y, s, -Math.PI / 2 + 0.15, a, true);
            }, 0, 'source-over');
            fx.at(360, () => {
                fx.shake(6, 300);
                fx.flash({ x: b.x, y: b.y, r: 220, color: '255,245,215', alpha: 0.45, dur: 450 });
                fx.emit(22, { x: b.x, y: b.y, speed: [3, 7], drag: 0.93, life: [500, 800], size: [3, 5], shape: 'star', colors: ['255,245,200', '255,255,255'] });
                for (let i = 0; i < 8; i++) {
                    const ang = (i / 8) * Math.PI * 2;
                    fx.slash({ x1: b.x + Math.cos(ang) * s * 0.7, y1: b.y + Math.sin(ang) * s * 0.7, x2: b.x + Math.cos(ang) * s * 1.15,
                        y2: b.y + Math.sin(ang) * s * 1.15, width: 3, dur: 320, color: '255,255,255' });
                }
            });
            fx.sound('clap', 360);
        }
    },

    // Gambler, Risky Reels, Reroll: dice tumble onto the board; one rolls a natural 20.
    luck(fx) {
        const { board: b } = fx;
        const dice = [-0.22, 0, 0.22].map((dx, i) => ({
            x0: b.x + dx * b.w - 120 + i * 40, x1: b.x + dx * b.w, y1: b.y + (i === 1 ? -10 : 18), spin: rand(3, 6) * (i % 2 ? -1 : 1),
            face: i === 1 ? 20 : Math.ceil(rand(1, 19)), delay: i * 110,
        }));
        const r = Math.min(b.h * 0.16, 46);
        for (const d of dice) {
            fx.draw(1400, (ctx, p) => {
                const t = Math.min(1, p / 0.55);
                const bounce = t < 1 ? Math.abs(Math.cos(t * Math.PI * 1.6)) * (1 - t) : 0;
                const x = d.x0 + (d.x1 - d.x0) * easeOut(t), y = d.y1 - (1 - easeOut(t)) * fx.H * 0.45 - bounce * r * 2.2;
                const a = p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2;
                drawD20(ctx, x, y, r, d.spin * (1 - easeOut(t)), a, t < 1 ? Math.ceil(rand(1, 20)) : d.face);
            }, d.delay, 'source-over');
        }
        fx.at(110 + 1400 * 0.55, () => {
            const d = dice[1];
            fx.glint({ x: d.x1 + r * 0.6, y: d.y1 - r * 0.6, size: 26, color: '255,230,140' });
            fx.emit(24, { x: d.x1, y: d.y1, speed: [2, 5], drag: 0.93, life: [500, 800], size: [2, 4], colors: PAL.gold });
        });
        fx.at(60, () => playSound('dice')); // the simulator's own dice sound
    },

    // Clean Slate, Spring Cleaning: a gust sweeps across the board, then everything sparkles.
    sweep(fx) {
        const { board: b } = fx;
        for (let i = 0; i < 6; i++) {
            const y = b.top + b.h * (0.15 + i * 0.14), curve = rand(-30, 30);
            fx.draw(800, (ctx, p) => {
                const head = easeOut(p) * (b.w + 300), tail = Math.max(0, head - 260);
                const a = (1 - p) * 0.55;
                ctx.strokeStyle = rgba('235,240,250', a); ctx.lineWidth = 2; ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(b.left - 150 + tail, y);
                ctx.quadraticCurveTo(b.left - 150 + (tail + head) / 2, y + curve, b.left - 150 + head, y);
                ctx.stroke();
            }, i * 50);
        }
        fx.emit(40, { x: b.left, y: b.y, spreadY: b.h * 0.4, spreadX: 30, angle: [-8, 8], speed: [10, 18], drag: 0.96, life: [500, 800], size: [1.5, 3],
            colors: ['220,210,190', '240,235,225'] });
        fx.emit(24, { x: b.x, y: b.y, spreadX: b.w * 0.4, spreadY: b.h * 0.35, speed: [0, 0.4], life: [500, 900], size: [3, 5], shape: 'star',
            colors: ['255,255,255', '220,240,255'], delay: [350, 800] });
        fx.sound('whoosh');
        fx.sound('sparkle', 400);
    },

    // The pieces of Marut: golden clockwork with a flash of the Edict's light.
    marut(fx) {
        const { card } = fx;
        CARD_FX_TYPES.machine(fx, { gearColor: '255,215,120', sparks: PAL.gold });
        fx.beam({ x: card.x, top: card.top - card.h * 0.6, bottom: card.bottom, width: card.w * 0.7, dur: 900, delay: 150 });
        fx.draw(900, (ctx, p) => {
            const sz = card.w * (0.6 + easeOut(p) * 1.6), a = (1 - p) * 0.7;
            ctx.save(); ctx.translate(card.x, card.y); ctx.rotate(Math.PI / 4 + p * 0.4);
            ctx.strokeStyle = rgba('255,225,140', a); ctx.lineWidth = 2.5; ctx.strokeRect(-sz / 2, -sz / 2, sz, sz);
            ctx.restore();
        }, 200);
    },

    // Dragon-themed Utility cards (Wyrmcall Ritual, Dragonfire Divination...): a roar over the board.
    draconic(fx) {
        CARD_FX_TYPES.dragon(fx, {});
    },
};

const CARD_FX_CATEGORY_RULES = [
    // [category, options, test]
    ['marut',    {},                       (c) => (c.tags || []).includes('Piece of Marut')],
    ['hands',    { variant: 'footsteps' }, (c) => c.class === 'Utility' && /\b(foot|feet|unfoot)\b/i.test(c.name) && !/\bhand\b/i.test(c.name)],
    ['hands',    { variant: 'release' },   (c) => c.class === 'Utility' && /\bunhand\b/i.test(c.name)],
    ['hands',    { variant: 'swipe' },     (c) => c.class === 'Utility' && /\b(hand me|hand off|hand-me|rehand)\b/i.test(c.name)],
    ['hands',    { variant: 'clap' },      (c) => c.class === 'Utility' && /\b(hands?|finger|arm)\b/i.test(c.name)],
    ['luck',     {},                       (c) => /\b(gambl\w*|risky|reels?|reroll|lucky|dice)\b/i.test(c.name)],
    ['sweep',    {},                       (c) => /\b(clean\w*|slate|sweep\w*|ventilation)\b/i.test(c.name)],
    // only when the text names no element, so Dragon's Breath stays fire and Dragon's Edict stays radiant
    ['draconic', {},                       (c) => c.class !== 'Summon' && /\b(dragon\w*|draconic|wyrm\w*|lizards?|scales?|heads?)\b/i.test(c.name) && !detectCardElement(c)],
];

/* ---------- Legendary flourish (layered over the base effect) ---------- */

function legendaryFlourish(fx) {
    const o = fx.card;
    fx.at(180, () => {
        fx.ring({ x: o.x, y: o.y, r0: o.w * 0.4, r1: o.w * 2.2, dur: 800, color: '255,215,120', width: 3, alpha: 0.75 });
        fx.emit(34, { x: o.x, y: o.y, spreadX: o.w * 0.4, spreadY: o.h * 0.4, speed: [1.5, 4.5], drag: 0.95, life: [700, 1100], size: [2, 4],
            colors: PAL.gold });
        fx.glint({ x: o.x - o.w * 0.3, y: o.top + o.h * 0.15, size: 28, color: '255,235,170', delay: 120 });
        fx.glint({ x: o.x + o.w * 0.35, y: o.y + o.h * 0.2, size: 20, color: '255,235,170', delay: 300 });
    });
}

/* ---------- Mythic signatures ---------- */

function slimeSignature(scale, colors) {
    return (fx) => {
        const { card } = fx;
        fx.shake(4 + scale * 4, 380);
        // gooey blobs splat out, fall, and squash
        fx.emit(Math.round(24 * scale), { x: card.x, y: card.y, angle: [190, 350], speed: [4, 8 + scale * 3], ay: 0.34, drag: 0.99, life: [800, 1100],
            size: [5, 9 + scale * 6], colors, fadePow: 2.5 });
        fx.draw(1300, (ctx, p) => {
            // wobbling goo puddle under the card
            const a = Math.sin(Math.PI * Math.min(1, p * 1.4)) * 0.55, w = card.w * (0.6 + scale * 0.5) * easeOut(Math.min(1, p * 2.5));
            const g = ctx.createRadialGradient(card.x, card.bottom, 0, card.x, card.bottom, w);
            g.addColorStop(0, rgba(colors[0], a)); g.addColorStop(1, rgba(colors[0], 0));
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.ellipse(card.x, card.bottom, w * (1 + Math.sin(p * 18) * 0.05), w * 0.3, 0, 0, Math.PI * 2); ctx.fill();
        }, 0, 'source-over');
        fx.emit(Math.round(10 * scale), { x: card.x, y: card.bottom, spreadX: card.w * 0.5, angle: [262, 278], speed: [0.6, 1.4], drag: 1, life: [900, 1300],
            size: [3, 7], shape: 'bubble', colors, wobble: 0.5, delay: [200, 700] });
        for (let i = 0; i < 1 + Math.round(scale); i++) {
            fx.ring({ x: card.x, y: card.y, r0: card.w * 0.3, r1: card.w * (1.3 + scale * 0.6), dur: 600, color: colors[0], width: 4, alpha: 0.5, delay: i * 140 });
        }
    };
}

const CARD_FX_SIGNATURES = {
    /* ---- Legendary ---- */

    // Prismatic Spray: eight coloured rays fan out across the board.
    '056'(fx) {
        const { board: b } = fx;
        const RAYS = ['255,70,70', '255,150,50', '255,230,70', '90,220,110', '80,150,255', '110,90,230', '190,110,255', '255,70,70'];
        const ox = b.x, oy = b.bottom + b.h * 0.35, len = Math.max(b.w, b.h) * 1.1;
        fx.flash({ x: ox, y: oy - b.h * 0.3, r: 380, color: '255,255,255', alpha: 0.35, dur: 600 });
        RAYS.forEach((col, i) => {
            const ang = (-90 + (i - 3.5) * 11) * DEG;
            fx.draw(1150, (ctx, p) => {
                const grow = easeOut(Math.min(1, p / 0.35)), a = p < 0.5 ? 1 : 1 - (p - 0.5) / 0.5;
                const L = len * grow, half = 0.045;
                const ex1 = ox + Math.cos(ang - half) * L, ey1 = oy + Math.sin(ang - half) * L;
                const ex2 = ox + Math.cos(ang + half) * L, ey2 = oy + Math.sin(ang + half) * L;
                const g = ctx.createLinearGradient(ox, oy, ox + Math.cos(ang) * L, oy + Math.sin(ang) * L);
                g.addColorStop(0, rgba(col, 0.9 * a)); g.addColorStop(1, rgba(col, 0));
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex1, ey1); ctx.lineTo(ex2, ey2); ctx.closePath(); ctx.fill();
            }, i * 55);
            fx.at(i * 55 + 200, () => fx.emit(8, {
                x: () => ox + Math.cos(ang) * rand(0.25, 0.8) * len, y: () => oy + Math.sin(ang) * rand(0.25, 0.8) * len,
                speed: [0.2, 1], life: [500, 900], size: [2, 4], shape: 'star', colors: [col, '255,255,255'],
            }));
        });
        fx.shake(5, 500);
        fx.sound('prismatic-spray');
    },

    // Ticking Time Bomb: three warning ticks, then BOOM.
    '144'(fx) {
        const { card } = fx;
        for (let i = 0; i < 3; i++) {
            const t = i * 330;
            fx.ring({ x: card.x, y: card.y, r0: card.w * 0.45, r1: card.w * 0.95, dur: 300, color: '255,70,50', width: 4, alpha: 0.9, delay: t });
            fx.flash({ x: card.x, y: card.y, r: card.w * 1.2, color: '255,60,40', alpha: 0.35 + i * 0.15, dur: 260, delay: t });
            fx.sound('tick', t);
        }
        fx.at(1000, () => {
            fx.shake(16, 650);
            fx.flash({ x: card.x, y: card.y, r: 520, color: '255,220,160', alpha: 0.7, dur: 700 });
            for (let i = 0; i < 3; i++) fx.ring({ x: card.x, y: card.y, r0: 20, r1: Math.max(fx.W, fx.H) * 0.6, dur: 700, color: '255,200,140', width: 6 - i, delay: i * 90 });
            fx.emit(70, { x: card.x, y: card.y, speed: [4, 12], drag: 0.93, life: [600, 1000], size: [3, 8], grow: 0.5, colors: PAL.fire });
            fx.emit(40, { x: card.x, y: card.y, speed: [6, 13], ay: 0.25, drag: 0.98, life: [600, 900], size: [2, 3.5], shape: 'spark', colors: ['255,240,200', '255,190,90'] });
            fx.emit(14, { x: card.x, y: card.y, speed: [1, 3], life: [1100, 1500], size: [34, 56], grow: 1.3, shape: 'smoke', color: '55,45,40', alpha: 0.5 });
        });
        fx.vignette({ color: '40,0,0', alpha: 0.35, dur: 1000 });
        fx.sound('explosion', 1000);
    },

    // Giant Crocodile: huge jaws snap shut across the board, with a splash.
    '052'(fx) {
        const { board: b } = fx;
        const teeth = 9, tw = b.w / teeth;
        const depth = b.h * 0.5;
        const jaw = (ctx, y, dir, a) => {
            // jaw body fades away from the teeth so it never blankets the whole screen
            const g = ctx.createLinearGradient(0, y, 0, y + dir * depth);
            g.addColorStop(0, rgba('70,95,55', a)); g.addColorStop(1, rgba('70,95,55', 0));
            ctx.fillStyle = g;
            ctx.fillRect(b.left - 20, dir < 0 ? y - depth : y, b.w + 40, depth);
            ctx.fillStyle = rgba('250,248,235', a);
            ctx.beginPath();
            for (let i = 0; i < teeth; i++) {
                const x = b.left + i * tw;
                ctx.moveTo(x, y); ctx.lineTo(x + tw / 2, y - dir * tw * 0.9); ctx.lineTo(x + tw, y);
            }
            ctx.fill();
        };
        fx.draw(1100, (ctx, p) => {
            const close = p < 0.32 ? easeInOut(p / 0.32) : p < 0.55 ? 1 : 1 - easeInOut((p - 0.55) / 0.45);
            const a = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
            const gap = (1 - close) * b.h * 0.8;
            jaw(ctx, b.y - gap / 2 - 2, -1, a * 0.95);
            jaw(ctx, b.y + gap / 2 + 2, 1, a * 0.95);
        }, 0, 'source-over');
        fx.at(350, () => {
            fx.shake(13, 450);
            fx.emit(46, { x: b.x, y: b.y, spreadX: b.w * 0.45, angle: [200, 340], speed: [4, 9], ay: 0.3, drag: 0.99, life: [600, 900], size: [2.5, 5],
                colors: ['150,200,255', '200,230,255', '255,255,255'] });
        });
        fx.sound('chomp', 330);
    },

    // Rat King: a swarm of rats boils out from under the throne.
    '053'(fx) {
        const { card } = fx;
        const rats = Array.from({ length: 34 }, () => ({
            ang: rand(0, Math.PI * 2), speed: rand(5, 9), wig: rand(0, 6), size: rand(7, 11), delay: rand(0, 350),
        }));
        fx.draw(1600, (ctx, p) => {
            const T = p * 1600;
            for (const r of rats) {
                const t = Math.max(0, T - r.delay) / 16.67;
                if (t <= 0) continue;
                const d = r.speed * t, wob = Math.sin(t * 0.6 + r.wig) * 0.35;
                const ang = r.ang + wob * 0.4;
                const x = card.x + Math.cos(r.ang) * d, y = card.y + card.h * 0.3 + Math.sin(r.ang) * d * 0.7;
                const a = Math.min(1, t / 6) * (1 - Math.max(0, (T - r.delay - 900) / 500));
                if (a <= 0) continue;
                ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
                ctx.fillStyle = rgba('55,45,40', a);
                ctx.beginPath(); ctx.ellipse(0, 0, r.size, r.size * 0.55, 0, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(r.size * 0.9, 0, r.size * 0.45, r.size * 0.35, 0, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = rgba('120,95,85', a); ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(-r.size, 0); ctx.quadraticCurveTo(-r.size * 1.8, Math.sin(t * 0.9 + r.wig) * r.size, -r.size * 2.4, 0); ctx.stroke();
                ctx.fillStyle = rgba('255,90,80', a);
                ctx.beginPath(); ctx.arc(r.size * 1.15, -r.size * 0.12, 1.4, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
        }, 0, 'source-over');
        // the king's crown glints above the card
        fx.draw(1000, (ctx, p) => {
            const a = Math.sin(Math.PI * p), cx = card.x, cy = card.top - 14 - p * 10, w = card.w * 0.45;
            ctx.fillStyle = rgba('255,210,90', a);
            ctx.beginPath();
            ctx.moveTo(cx - w / 2, cy); ctx.lineTo(cx - w / 2, cy - w * 0.35); ctx.lineTo(cx - w / 4, cy - w * 0.15);
            ctx.lineTo(cx, cy - w * 0.45); ctx.lineTo(cx + w / 4, cy - w * 0.15); ctx.lineTo(cx + w / 2, cy - w * 0.35); ctx.lineTo(cx + w / 2, cy);
            ctx.closePath(); ctx.fill();
        }, 150);
        fx.glint({ x: card.x, y: card.top - 30, size: 24, delay: 500 });
        fx.sound('rat-king');
    },

    // Mirror of Echoed Power: a mirror pane shimmers, echoes outward, and shatters.
    '172'(fx) {
        const { board: b } = fx;
        const w = Math.min(b.h * 0.6, 170), h = w * 1.35;
        fx.draw(700, (ctx, p) => {
            const a = Math.min(1, p * 4) * 0.9;
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = rgba('200,220,240', a * 0.35); ctx.fillRect(b.x - w / 2, b.y - h / 2, w, h);
            ctx.strokeStyle = rgba('235,245,255', a); ctx.lineWidth = 3; ctx.strokeRect(b.x - w / 2, b.y - h / 2, w, h);
            ctx.beginPath(); ctx.rect(b.x - w / 2, b.y - h / 2, w, h); ctx.clip();
            const sx = b.x - w + easeInOut(p) * w * 2;
            const g = ctx.createLinearGradient(sx - 30, 0, sx + 30, 0);
            g.addColorStop(0, rgba('255,255,255', 0)); g.addColorStop(0.5, rgba('255,255,255', a * 0.8)); g.addColorStop(1, rgba('255,255,255', 0));
            ctx.fillStyle = g; ctx.fillRect(b.x - w / 2, b.y - h / 2, w, h);
            ctx.restore();
        });
        for (let i = 1; i <= 3; i++) {
            fx.draw(600, (ctx, p) => {
                const sc = 1 + easeOut(p) * 0.35 * i, a = (1 - p) * 0.55;
                ctx.strokeStyle = rgba('210,230,255', a); ctx.lineWidth = 2;
                ctx.strokeRect(b.x - (w * sc) / 2, b.y - (h * sc) / 2, w * sc, h * sc);
            }, 250 + i * 90);
        }
        fx.at(680, () => {
            fx.flash({ x: b.x, y: b.y, r: 260, color: '230,240,255', alpha: 0.5, dur: 450 });
            fx.emit(46, { x: b.x, y: b.y, spreadX: w * 0.5, spreadY: h * 0.5, speed: [3, 9], ay: 0.18, drag: 0.98, life: [600, 1000], size: [4, 8],
                shape: 'shard', spin: [-10, 10], colors: ['210,230,255', '245,250,255', '170,200,240'] });
            fx.shake(5, 300);
        });
        fx.sound('mirror');
        fx.sound('glass-shatter', 680);
    },

    // Gold Dragons: the dragon effect, breathing gold.
    '086'(fx) { CARD_FX_TYPES.dragon(fx, { element: 'gold' }); fx.sound('dragon'); },
    '087'(fx) { CARD_FX_TYPES.dragon(fx, { element: 'gold' }); fx.sound('dragon'); },

    // Forest Queen: vines and petals together, crowned with a glint.
    '114'(fx) {
        CARD_FX_TYPES.plant(fx);
        CARD_FX_TYPES.fey(fx);
        fx.glint({ x: fx.card.x, y: fx.card.top - 8, size: 30, color: '220,255,200', delay: 350, dur: 800 });
        fx.sound('forest-queen');
    },

    /* ---- Mythic ---- */

    // Iron Golem: a ground-shaking stomp; molten cracks race out and steam hisses up.
    '059'(fx) {
        const { card } = fx;
        fx.vignette({ alpha: 0.35, dur: 1600 });
        fx.shake(16, 700);
        fx.ring({ x: card.x, y: card.bottom, r0: 20, r1: Math.max(fx.W, fx.H) * 0.6, dur: 900, color: '255,200,140', width: 6, alpha: 0.6 });
        const cracks = Array.from({ length: 7 }, (_, i) => {
            const ang = Math.PI * (0.05 + (i / 6) * 0.9) + Math.PI;
            return jaggedPath(card.x, card.bottom, card.x + Math.cos(ang) * rand(260, 460), card.bottom - Math.sin(ang) * rand(-30, 140), 9, 14);
        });
        fx.draw(1700, (ctx, p) => {
            const grow = easeOut(Math.min(1, p / 0.35)), a = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
            for (const pts of cracks) {
                const n = Math.max(2, Math.round(pts.length * grow));
                ctx.strokeStyle = rgba('255,120,40', a * 0.4); ctx.lineWidth = 7; strokePts(ctx, pts.slice(0, n));
                ctx.strokeStyle = rgba('255,220,140', a); ctx.lineWidth = 2; strokePts(ctx, pts.slice(0, n));
            }
        });
        fx.emit(60, { x: card.x, y: card.bottom, spreadX: card.w * 0.6, angle: [200, 340], speed: [4, 10], ay: 0.3, drag: 0.98, life: [600, 1000],
            size: [2, 3.5], shape: 'spark', colors: PAL.fire, len: 2 });
        fx.emit(14, { x: card.x, y: card.bottom, spreadX: card.w, angle: [250, 290], speed: [1, 2.5], life: [1200, 1700], size: [24, 40], grow: 1.6,
            shape: 'smoke', color: '210,210,215', alpha: 0.35, delay: [200, 500] });
        fx.at(450, () => fx.flash({ x: card.x, y: card.bottom, r: 320, color: '255,140,60', alpha: 0.4, dur: 900 }));
    },

    // Meteor Swarm: four blazing orbs plummet onto the board, one after another.
    '060'(fx) {
        const { board: b } = fx;
        fx.vignette({ color: '25,5,0', alpha: 0.45, dur: 2400 });
        const targets = [[-0.32, -0.15], [0.28, 0.1], [-0.08, 0.28], [0.36, -0.28]];
        targets.forEach(([tx, ty], i) => {
            const x2 = b.x + tx * b.w, y2 = b.y + ty * b.h * 1.4, x1 = x2 + 380, y1 = -60;
            const delay = i * 300;
            fx.draw(420, (ctx, p) => {
                const t = p * p;
                const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
                const g = ctx.createRadialGradient(x, y, 0, x, y, 28);
                g.addColorStop(0, rgba('255,250,220', 1)); g.addColorStop(0.4, rgba('255,170,60', 0.9)); g.addColorStop(1, rgba('255,90,30', 0));
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 28, 0, Math.PI * 2); ctx.fill();
                fx.emit(2, { x, y, spreadX: 6, spreadY: 6, speed: [0.5, 1.5], angle: [-60, -20], life: [300, 500], size: [4, 9], grow: 1, colors: PAL.fire });
            }, delay);
            fx.sound('meteor-impact', delay + 410);
            fx.at(delay + 410, () => {
                fx.flash({ x: x2, y: y2, r: 260, color: '255,150,60', alpha: 0.55, dur: 600 });
                fx.ring({ x: x2, y: y2, r0: 10, r1: 200, dur: 550, color: '255,210,140', width: 5 });
                fx.emit(45, { x: x2, y: y2, speed: [3, 10], drag: 0.93, ay: -0.02, life: [600, 1000], size: [3, 8], grow: 0.5, colors: PAL.fire });
                fx.emit(6, { x: x2, y: y2, speed: [0.5, 2], angle: [230, 310], life: [1000, 1400], size: [30, 46], grow: 1.3, shape: 'smoke',
                    color: '60,40,30', alpha: 0.45 });
                fx.shake(10, 380);
            });
        });
    },

    // Hydra: Triple Breath, three heads, three roars, three gouts of fire.
    '090'(fx) {
        const { card } = fx;
        fx.vignette({ alpha: 0.4, dur: 2400 });
        [[150, 120], [100, 80], [60, 30]].forEach(([from, to], h) => {
            const delay = h * 420;
            fx.ring({ x: card.x, y: card.y, r0: card.w * 0.4, r1: Math.max(fx.W, fx.H) * 0.5, dur: 650, width: 4, alpha: 0.55, delay });
            fx.at(delay, () => fx.shake(9, 400));
            fx.sound(h === 0 ? 'hydra' : 'dragon', delay);
            fx.sound('breath', delay + 120);
            fx.every(16, 520, (p) => fx.at(delay + 120, () => {
                emitBreath(fx, card.x, card.y + card.h * 0.2, from + (to - from) * p, BREATH.fire, '60,45,35', 1.1);
            }));
        });
        fx.flash({ x: card.x, y: card.y + card.h * 0.4, r: 420, color: '255,140,60', alpha: 0.35, dur: 1500, delay: 150 });
    },

    // Mr. Hands: a cartoon SLAP! with action lines and dizzy stars.
    '147'(fx) {
        const { card } = fx;
        const cx = card.x + card.w * 0.2, cy = card.y - card.h * 0.05;
        fx.at(60, () => fx.shake(10, 320));
        fx.draw(900, (ctx, p) => {
            const pop = p < 0.18 ? easeOut(p / 0.18) * 1.15 : 1.15 - Math.min(0.15, (p - 0.18) * 0.6);
            const a = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.12); ctx.scale(pop, pop);
            const spikes = 12, R = card.w * 0.75, r = R * 0.62;
            ctx.beginPath();
            for (let i = 0; i <= spikes * 2; i++) {
                const ang = (i / (spikes * 2)) * Math.PI * 2, rr = i % 2 ? r : R;
                ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
            }
            ctx.closePath();
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = rgba('255,225,70', a); ctx.fill();
            ctx.lineWidth = 4; ctx.strokeStyle = rgba('40,25,10', a); ctx.stroke();
            ctx.font = `800 ${Math.round(card.w * 0.34)}px "Nunito Sans", sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.lineWidth = 6; ctx.strokeStyle = rgba('40,25,10', a); ctx.strokeText('SLAP!', 0, 2);
            ctx.fillStyle = rgba('255,90,60', a); ctx.fillText('SLAP!', 0, 2);
            ctx.restore();
        }, 0, 'source-over');
        for (let i = 0; i < 10; i++) {
            const ang = (i / 10) * Math.PI * 2;
            fx.slash({ x1: cx + Math.cos(ang) * card.w * 0.8, y1: cy + Math.sin(ang) * card.w * 0.8, x2: cx + Math.cos(ang) * card.w * 1.25,
                y2: cy + Math.sin(ang) * card.w * 1.25, width: 3, dur: 380, color: '255,255,255' });
        }
        fx.draw(1300, (ctx, p) => {
            const a = Math.sin(Math.PI * p);
            for (let i = 0; i < 4; i++) {
                const ang = p * 7 + (i / 4) * Math.PI * 2;
                drawStar(ctx, card.x + Math.cos(ang) * card.w * 0.45, card.top + Math.sin(ang) * card.w * 0.12, 9, '255,240,120', a);
            }
        }, 450);
    },

    // Marut: Blazing Edict, a judgement cube of radiant light expands from the card.
    '173'(fx) {
        const { card } = fx;
        fx.vignette({ color: '30,20,0', alpha: 0.35, dur: 2000 });
        fx.beam({ x: card.x, top: 0, bottom: card.bottom, width: card.w * 1.2, dur: 1400 });
        fx.shake(8, 500);
        for (let i = 0; i < 3; i++) {
            fx.draw(1100, (ctx, p) => {
                const s = card.w * (0.5 + easeOut(p) * (2.6 + i * 0.7)), a = (1 - p) * 0.8;
                ctx.save(); ctx.translate(card.x, card.y); ctx.rotate(Math.PI / 4 * (i % 2) + p * 0.3);
                ctx.strokeStyle = rgba('255,225,140', a); ctx.lineWidth = 3;
                ctx.strokeRect(-s / 2, -s / 2, s, s);
                ctx.restore();
            }, 250 + i * 200);
        }
        fx.at(250, () => {
            fx.flash({ x: card.x, y: card.y, r: 420, color: '255,230,150', alpha: 0.5, dur: 900 });
            fx.emit(50, { x: card.x, y: card.y, speed: [2, 7], drag: 0.95, life: [700, 1200], size: [2, 4], colors: PAL.radiant });
        });
        fx.glint({ x: card.x, y: card.top + card.h * 0.2, size: 36, color: '255,245,210', delay: 600, dur: 700 });
    },

    // The Suspicious trio share a goo splat that grows with the card.
    'PR1-1': slimeSignature(0.6, ['150,240,90', '190,255,130', '110,210,70']),
    'PR1-2': slimeSignature(0.85, ['255,210,90', '255,235,150', '240,180,60']),
    'PR1-3': slimeSignature(1.1, ['90,220,200', '150,250,230', '60,190,170']),

    // The Oblex: dark psychic goo creeps in from the edges and its many eyes blink open.
    'PR1-4'(fx) {
        const { card } = fx;
        const eyes = Array.from({ length: 9 }, (_, i) => {
            const ang = rand(0, Math.PI * 2), d = rand(0.35, 0.48);
            return { x: fx.W / 2 + Math.cos(ang) * fx.W * d, y: fx.H / 2 + Math.sin(ang) * fx.H * d, r: rand(9, 18), t: rand(0.15, 0.45), i };
        });
        fx.draw(2300, (ctx, p) => {
            const creep = Math.sin(Math.PI * Math.min(1, p * 1.25)) * 0.9;
            const g = ctx.createRadialGradient(fx.W / 2, fx.H / 2, Math.min(fx.W, fx.H) * (0.62 - creep * 0.22), fx.W / 2, fx.H / 2, Math.max(fx.W, fx.H) * 0.72);
            g.addColorStop(0, rgba('40,10,60', 0)); g.addColorStop(0.45, rgba('70,20,100', creep * 0.7)); g.addColorStop(1, rgba('30,5,45', creep * 0.95));
            ctx.fillStyle = g; ctx.fillRect(0, 0, fx.W, fx.H);
            for (const e of eyes) {
                const open = Math.max(0, Math.min(1, (p - e.t) * 6)) * Math.max(0, Math.min(1, (0.92 - p) * 6));
                const blink = Math.abs(Math.sin(p * 9 + e.i)) > 0.96 ? 0.15 : 1;
                const h = e.r * 0.6 * open * blink;
                if (h < 0.5) continue;
                ctx.fillStyle = rgba('255,235,250', 0.9 * creep);
                ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r, h, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = rgba('200,40,160', creep);
                ctx.beginPath(); ctx.arc(e.x + Math.sin(p * 4 + e.i) * e.r * 0.25, e.y, Math.min(h, e.r * 0.4), 0, Math.PI * 2); ctx.fill();
            }
        }, 0, 'source-over');
        for (let i = 0; i < 4; i++) fx.ring({ x: card.x, y: card.y, r0: card.w * 0.3, r1: card.w * 2.6, dur: 900, color: '255,140,220', width: 2, alpha: 0.55, delay: 200 + i * 220 });
        fx.emit(30, { x: card.x, y: card.y, speed: [0.5, 2.5], life: [900, 1400], size: [2, 4], colors: PAL.psychic, wobble: 0.6, delay: [0, 600] });
    },
};

/* ---------- Choosing an effect ---------- */

const CARD_FX_KEYWORDS = [
    // order breaks ties: earlier wins
    ['fire',      /\b(fire|flames?|flaming|burn\w*|blaz\w*|embers?|inferno|meteor\w*|rekindle\w*)\b/gi],
    ['cold',      /\b(cold|frost\w*|freez\w*|ice|icy|snow\w*)\b/gi],
    ['lightning', /\b(lightning|electric\w*|shock\w*)\b/gi],
    ['thunder',   /\b(thunder\w*|deafen\w*|roar\w*)\b/gi],
    ['force',     /\bforce damage\b|\bmissiles?\b/gi],
    ['necrotic',  /\b(necrotic|life drain|wither\w*|reanimat\w*|sacrific\w*)\b/gi],
    ['radiant',   /\b(radiant|holy|divine|sacred|sunlight|luminous|ascension|faith)\b/gi],
    ['poison',    /\b(poison\w*|toxic|venom\w*)\b/gi],
    ['acid',      /\b(acid\w*|corro\w*|caustic)\b/gi],
    ['psychic',   /\b(psychic|charm\w*|frighten\w*|compel\w*|illusion\w*|polymorph\w*)\b/gi],
    ['healing',   /\b(heal\w*|regains?)\b/gi],
    ['time',      /\b(clock\w*|rewind\w*|haste|slow|fast forward)\b/gi],
    ['earth',     /\b(earth\w*|stone|sand|rocks?|pit|quake)\b/gi],
];

function detectCardElement(card) {
    const actions = (card.summonInfo?.actions || []).map(a => `${a.name} ${a.description}`).join(' ');
    const text = [card.name, card.description || '', actions, typeof card.reaction === 'string' ? card.reaction : JSON.stringify(card.reaction || '')].join(' ');
    let best = null, bestCount = 0;
    for (const [element, re] of CARD_FX_KEYWORDS) {
        let n = (text.match(re) || []).length;
        if (element === 'time' && /\btime\b/i.test(card.name)) n += 2;
        if (n > bestCount) { best = element; bestCount = n; }
    }
    return best;
}

// Returns { kind, key, element?, label } describing what this card will play.
function resolveCardEffect(card) {
    if (!card) return null;
    if (card.effect) {
        const key = String(card.effect).toLowerCase();
        if (CARD_FX_TYPES[key]) return { kind: 'type', key, element: detectCardElement(card), label: `${key} (override)` };
        if (CARD_FX_ELEMENTS[key]) return { kind: 'element', key, label: `${key} (override)` };
        if (CARD_FX_CATEGORIES[key]) return { kind: 'category', key, options: {}, label: `${key} (override)` };
    }
    if (CARD_FX_SIGNATURES[card.id]) return { kind: 'signature', key: card.id, label: `${card.name} signature` };
    const category = CARD_FX_CATEGORY_RULES.find(([, , test]) => test(card));
    if (category) {
        const [key, options] = category;
        return { kind: 'category', key, options, label: key + (options.variant && options.variant !== 'clap' ? ` (${options.variant})` : '') };
    }

    const type = card.type ? card.type.toLowerCase() : null;
    const element = detectCardElement(card);
    if (card.class === 'Summon') {
        if (type && CARD_FX_TYPES[type]) return { kind: 'type', key: type, element, label: type + (type === 'dragon' && element ? ` (${element} breath)` : '') };
        return { kind: 'element', key: 'summon', label: 'summon' };
    }
    if (element) return { kind: 'element', key: element, label: element };
    if (type && CARD_FX_TYPES[type]) return { kind: 'type', key: type, label: `${type} (from type)` };
    const fallback = { Spell: 'arcane', Utility: 'utility', Reaction: 'reaction' }[card.class] || 'arcane';
    return { kind: 'element', key: fallback, label: fallback };
}

/* ---------- Entry point ---------- */

// The main sound file for an effect: assets/sounds/fx/<name>.mp3.
// Signatures that set their own sounds in their bodies return null here.
const SIGNATURE_SOUNDS = {
    '059': 'iron-golem', '060': 'meteor-swarm', '090': null, '147': 'mr-hands', '173': 'marut-edict',
    'PR1-1': 'slime', 'PR1-2': 'slime', 'PR1-3': 'slime', 'PR1-4': 'oblex',
};
function fxSoundName(spec) {
    if (spec.kind === 'signature') return SIGNATURE_SOUNDS[spec.key] ?? null;
    if (spec.kind === 'category') {
        if (spec.key === 'draconic') return 'dragon';
        return spec.key === 'hands' || spec.key === 'luck' || spec.key === 'sweep' ? null : spec.key; // these set their own beats
    }
    return spec.key;
}

function visibleRect(el) {
    const r = el?.getBoundingClientRect();
    return r && r.width > 0 && r.height > 0 ? r : null;
}

// Play the card's effect. landedEl is the card element now on the board (Summon/Reaction), if any.
function playCardEffect(card, landedEl = null) {
    if (cardFxMode === 'off' || prefersReducedMotion.matches || !card) return null;
    const spec = resolveCardEffect(card);
    if (!spec) return null;

    fxStart();
    const vw = window.innerWidth, vh = window.innerHeight;
    const fallback = { left: vw / 2 - 90, top: vh / 2 - 126, width: 180, height: 252, right: vw / 2 + 90, bottom: vh / 2 + 126 };
    const boardRect = visibleRect(document.getElementById('simulatorZones')) || fallback;
    const fromCard = spec.kind === 'type' || spec.kind === 'signature';
    const originRect = visibleRect(landedEl) || (fromCard ? fallback : boardRect);

    const subtle = cardFxMode === 'subtle';
    const intensity = (subtle ? 0.5 : 1) * (card.rarity === 'Legendary' ? 1.3 : 1);
    const fx = makeFxApi(rectInfo(originRect), rectInfo(boardRect), { intensity, subtle });

    // On a light board, dim the scene briefly so the light effects have something to glow against.
    if (!FX.additive) {
        const dur = spec.kind === 'signature' ? 2400 : 1500;
        fx.draw(dur, (ctx, p) => {
            ctx.fillStyle = rgba('25,18,10', (subtle ? 0.14 : 0.3) * Math.sin(Math.PI * Math.min(1, p * 1.15)));
            ctx.fillRect(0, 0, FX.W, FX.H);
        }, 0, 'source-over');
    }

    try {
        if (spec.kind === 'signature') CARD_FX_SIGNATURES[spec.key](fx);
        else if (spec.kind === 'category') CARD_FX_CATEGORIES[spec.key](fx, spec.options);
        else if (spec.kind === 'type') CARD_FX_TYPES[spec.key](fx, { element: spec.element });
        else CARD_FX_ELEMENTS[spec.key](fx);
        playFxSound(fxSoundName(spec, card));
        if (card.rarity === 'Legendary' && !subtle) { legendaryFlourish(fx); fx.sound('legendary', 180); }
    } catch (err) {
        console.warn('card effect failed', err);
    }
    return spec;
}

/* ---------- One-off effects outside the play flow ---------- */

// Run `fn(fx)` aimed at element `el`. Returns false when effects are off.
function playFxOn(el, fn, { dimMs = 1400 } = {}) {
    if (cardFxMode === 'off' || prefersReducedMotion.matches) return false;
    fxStart();
    const vw = window.innerWidth, vh = window.innerHeight;
    const fallback = { left: vw / 2 - 90, top: vh / 2 - 126, width: 180, height: 252, right: vw / 2 + 90, bottom: vh / 2 + 126 };
    const boardRect = visibleRect(document.getElementById('simulatorZones')) || fallback;
    const subtle = cardFxMode === 'subtle';
    const fx = makeFxApi(rectInfo(visibleRect(el) || fallback), rectInfo(boardRect), { intensity: subtle ? 0.5 : 1, subtle });
    if (!FX.additive && dimMs) {
        fx.draw(dimMs, (ctx, p) => {
            ctx.fillStyle = rgba('25,18,10', (subtle ? 0.12 : 0.24) * Math.sin(Math.PI * Math.min(1, p * 1.15)));
            ctx.fillRect(0, 0, FX.W, FX.H);
        }, 0, 'source-over');
    }
    try { fn(fx); } catch (err) { console.warn('effect failed', err); }
    return true;
}

// A Reaction is set face-up in the Reaction Zone: a ward stamps down around it and locks.
function playReactionSetEffect(el) {
    return playFxOn(el, (fx) => {
        const { card } = fx;
        const hex = (ctx, r) => {
            ctx.beginPath();
            for (let i = 0; i <= 6; i++) {
                const ang = -Math.PI / 2 + (i / 6) * Math.PI * 2;
                i ? ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r) : ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
            }
        };
        // ward stamps in from large and settles snug around the card
        fx.draw(1100, (ctx, p) => {
            const stamp = easeOut(Math.min(1, p / 0.3));
            const r = card.h * (0.95 - 0.3 * stamp) * 0.62;
            const a = (p < 0.3 ? stamp : 1 - (p - 0.3) / 0.7) * 0.8;
            ctx.save(); ctx.translate(card.x, card.y); ctx.rotate((1 - stamp) * 0.5);
            ctx.strokeStyle = rgba('140,190,255', a); ctx.lineWidth = 3; hex(ctx, r); ctx.stroke();
            ctx.strokeStyle = rgba('200,225,255', a * 0.5); ctx.lineWidth = 1.2; hex(ctx, r * 0.86); ctx.stroke();
            ctx.restore();
        });
        fx.at(330, () => {
            fx.ring({ x: card.x, y: card.y, r0: card.w * 0.5, r1: card.w * 1.3, dur: 450, color: '170,210,255', width: 2 });
            fx.glint({ x: card.x, y: card.top + card.h * 0.12, size: 20, color: '210,230,255' });
            fx.emit(14, { x: card.x, y: card.y, spreadX: card.w * 0.5, spreadY: card.h * 0.5, speed: [0.2, 0.8], life: [500, 900], size: [2, 3],
                shape: 'star', colors: ['190,215,255', '235,245,255'] });
        });
        fx.sound('reaction-set', 300);
    }, { dimMs: 900 });
}

// A Summon dies: the card cracks, ash falls, and its soul drifts up and away.
function playDeathEffect(el) {
    return playFxOn(el, (fx) => {
        const { card } = fx;
        fx.vignette({ color: '10,0,0', alpha: 0.3, dur: 1400 });
        fx.flash({ x: card.x, y: card.y, r: card.w * 1.8, color: '200,40,40', alpha: 0.3, dur: 500 });
        const cracks = Array.from({ length: 5 }, () => {
            const ang = rand(0, Math.PI * 2), len = rand(0.35, 0.6) * card.h;
            return jaggedPath(card.x, card.y, card.x + Math.cos(ang) * len * 0.6, card.y + Math.sin(ang) * len, 6, 7);
        });
        fx.draw(900, (ctx, p) => {
            const grow = easeOut(Math.min(1, p / 0.4)), a = p < 0.6 ? 0.9 : 0.9 * (1 - (p - 0.6) / 0.4);
            ctx.save();
            ctx.beginPath(); ctx.rect(card.left, card.top, card.w, card.h); ctx.clip();
            for (const pts of cracks) {
                const n = Math.max(2, Math.round(pts.length * grow));
                ctx.strokeStyle = rgba('20,10,10', a); ctx.lineWidth = 2.4; strokePts(ctx, pts.slice(0, n));
                ctx.strokeStyle = rgba('255,120,90', a * 0.5); ctx.lineWidth = 0.8; strokePts(ctx, pts.slice(0, n));
            }
            ctx.restore();
        }, 0, 'source-over');
        // ash drifting down off the card
        fx.emit(30, { x: card.x, y: card.y, spreadX: card.w * 0.5, spreadY: card.h * 0.45, angle: [70, 110], speed: [0.4, 1.4], ay: 0.015, drag: 0.99,
            life: [1000, 1500], size: [1.5, 3], shape: 'rock', spin: [-5, 5], colors: ['120,115,110', '80,75,72', '160,150,140'], delay: [150, 600] });
        // the soul: a pale wisp that rises, sways, and fades out
        fx.draw(1700, (ctx, p) => {
            const t = easeInOut(Math.min(1, p / 0.95));
            const x = card.x + Math.sin(p * 7) * card.w * 0.12, y = card.y - t * card.h * 1.6;
            const a = (p < 0.15 ? p / 0.15 : 1 - Math.max(0, (p - 0.5) / 0.5)) * 0.85, r = card.w * 0.16;
            const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
            g.addColorStop(0, rgba('230,245,255', a)); g.addColorStop(0.35, rgba('170,210,240', a * 0.5)); g.addColorStop(1, rgba('170,210,240', 0));
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, Math.PI * 2); ctx.fill();
            if (Math.random() < 0.6) fx.emit(1, { x, y: y + r, speed: [0.1, 0.4], angle: [80, 100], life: [500, 800], size: [3, 6], grow: 0.8,
                colors: ['200,225,245'], alpha: 0.5 });
        }, 250);
    }, { dimMs: 1500 });
}

/* ---------- Setting: Full / Subtle / Off ---------- */

function setCardFxMode(mode) {
    cardFxMode = mode;
    localStorage.setItem(CARD_FX_KEY, mode);
    document.querySelectorAll('#cardFxToggle button').forEach(btn => {
        const on = btn.dataset.fx === mode;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-checked', String(on));
    });
}

document.querySelectorAll('#cardFxToggle button').forEach(btn => {
    btn.addEventListener('click', () => setCardFxMode(btn.dataset.fx));
});
setCardFxMode(cardFxMode);
