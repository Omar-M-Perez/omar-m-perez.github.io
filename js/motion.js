// motion.js
// the tactile layer on top of main.js: spring physics, the hero morph canvas,
// the shared-element card morph, the liquid photo shader and the lens cursor.
// no libraries, everything runs off one requestAnimationFrame loop and only
// touches transform / opacity so the browser can keep it on the gpu.

// the motion is part of the work here, so it stays on even when the computer has
// "reduce animations" switched on. that setting used to freeze the hero completely
const reduceMotion = false;
const hoverPointer = matchMedia("(hover: hover) and (pointer: fine)").matches;


// ---------- one shared frame loop ----------

// anything that animates registers a function here. the loop sleeps when the list is empty
const ticks = new Set();
let loopOn = false;
let lastT = performance.now();

function frame(now) {
    // clamp dt so a background tab doesn't make springs explode when it comes back
    const dt = Math.min((now - lastT) / 1000, 1 / 30);
    lastT = now;
    // one broken animation should never stop all the others, so each runs on its own
    ticks.forEach(fn => {
        try {
            if (fn(dt, now) === false) ticks.delete(fn);
        } catch (err) {
            ticks.delete(fn);
            console.warn("animation stopped:", err);
        }
    });
    if (ticks.size) requestAnimationFrame(frame);
    else loopOn = false;
}

function addTick(fn) {
    ticks.add(fn);
    if (!loopOn) {
        loopOn = true;
        lastT = performance.now();
        requestAnimationFrame(frame);
    }
}


// ---------- spring physics ----------

// a damped spring: stiffness pulls toward the target, damping eats the wobble.
// high stiffness + high damping = snappy and rigid. low damping = elastic overshoot
function spring({ from = 0, to = 1, stiffness = 170, damping = 26, mass = 1, onUpdate, onDone }) {
    let x = from;
    let v = 0;
    let stopped = false;
    if (reduceMotion) {
        onUpdate && onUpdate(to);
        onDone && onDone();
        return { stop() {} };
    }
    addTick(dt => {
        if (stopped) return false;
        // small fixed sub steps keep it stable even with a stiff spring
        const steps = 4;
        const h = dt / steps;
        for (let i = 0; i < steps; i++) {
            const force = -stiffness * (x - to) - damping * v;
            v += (force / mass) * h;
            x += v * h;
        }
        onUpdate && onUpdate(x);
        if (Math.abs(v) < 0.001 && Math.abs(x - to) < 0.001) {
            onUpdate && onUpdate(to);
            onDone && onDone();
            return false;
        }
    });
    return { stop() { stopped = true; } };
}

const lerp = (a, b, t) => a + (b - a) * t;

// reads a css variable so the canvas always matches the current theme
const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#e63027";


// ---------- hero: photo / film / print morph ----------

// ~500 particles, each tied to its own spring. switching mode just swaps the
// targets and the spring settings, so the same dots become a camera viewfinder,
// a kinetic swarm or a rigid wireframe
const heroStage = $(".hero-stage");

if (heroStage) {
    const canvas = $(".morph-canvas", heroStage);
    const ctx = canvas.getContext("2d");
    const pill = $(".mode-pill", heroStage);
    const caption = $(".stage-caption", heroStage);
    const tabs = $$(".mode-switch button", heroStage);

    const N = 480;
    const dots = Array.from({ length: N }, () => ({ x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, z: 0 }));
    let W = 0, H = 0, R = 0, dpr = 1;
    let mode = "photo";
    let modeAge = 0;
    let mouse = { x: -9999, y: -9999, on: false };
    let colors = {};
    let visible = true;
    let userPicked = false;

    // each mode feels different because the physics is different, not just the shape
    const feel = {
        photo: { k: 120, c: 14, repel: 35, label: "find the frame, then focus" }, // firm but springy, like a camera finding focus
        film: { k: 38, c: 6.5, repel: 170, label: "motion, frame by frame" }, // loose, it scatters from the cursor
        print: { k: 260, c: 30, repel: 25, label: "built on a grid" },        // stiff and rigid, barely moves
    };

    function readColors() {
        colors = { accent: cssVar("--accent"), ink: cssVar("--text-primary"), soft: cssVar("--text-secondary") };
    }

    function resize() {
        const r = canvas.getBoundingClientRect();
        dpr = Math.min(devicePixelRatio || 1, 2);
        W = r.width; H = r.height;
        R = Math.min(W, H) * 0.38;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ---- targets for each mode ----

    // photo: a camera viewfinder. corner brackets of a 3:2 frame, rule of thirds,
    // a grid of af points, and a focus box that chases the cursor and locks on
    let focus = { x: 0, y: 0, vx: 0, vy: 0, locked: 0 };
    let vf = null;

    function photoTargets(t) {
        const cx = W / 2, cy = H / 2;
        const fw = Math.min(W * 0.92, R * 2.5), fh = fw * 2 / 3;
        const L = cx - fw / 2, T = cy - fh / 2;
        vf = { L, T, fw, fh };

        // where the focus box wants to be: the cursor, or a slow wander when nobody is pointing
        let gx = cx + Math.sin(t * 0.55) * fw * 0.28;
        let gy = cy + Math.sin(t * 0.83 + 1) * fh * 0.22;
        if (mouse.on) { gx = mouse.x; gy = mouse.y; }
        const box = fh * 0.26;
        gx = Math.min(L + fw - box, Math.max(L + box, gx));
        gy = Math.min(T + fh - box, Math.max(T + box, gy));

        const arm = fw * 0.09;
        dots.forEach((d, i) => {
            const part = i % 4;
            const k = Math.floor(i / 4);
            const u = (k % 15) / 14;
            d.role = part;
            if (part === 0) {
                // the 4 corner brackets, each one two arms
                const corner = Math.floor(k / 30) % 4;
                const horiz = Math.floor(k / 15) % 2 === 0;
                const sx = corner % 2 ? -1 : 1, sy = corner > 1 ? -1 : 1;
                const ox = corner % 2 ? L + fw : L, oy = corner > 1 ? T + fh : T;
                d.tx = ox + (horiz ? sx * u * arm : 0);
                d.ty = oy + (horiz ? 0 : sy * u * arm);
            } else if (part === 1) {
                // rule of thirds, four faint lines
                const line = k % 4;
                const v = (Math.floor(k / 4) % 30) / 29;
                if (line < 2) { d.tx = L + fw * (line + 1) / 3; d.ty = T + v * fh; }
                else { d.tx = L + v * fw; d.ty = T + fh * (line - 1) / 3; }
            } else if (part === 2) {
                // the focus box, same bracket idea but small and it moves
                const corner = Math.floor(k / 8) % 4;
                const horiz = Math.floor(k / 4) % 2 === 0;
                const s = (k % 4) / 3;
                const half = box * (1 - focus.locked * 0.12);
                const sx = corner % 2 ? -1 : 1, sy = corner > 1 ? -1 : 1;
                const ox = focus.x + (corner % 2 ? half : -half), oy = focus.y + (corner > 1 ? half : -half);
                d.tx = ox + (horiz ? sx * s * half * 0.45 : 0);
                d.ty = oy + (horiz ? 0 : sy * s * half * 0.45);
            } else {
                // 5 x 3 af points, each a tiny square of 8 dots
                const p = k % 15;
                const col = p % 5, row = Math.floor(p / 5);
                const px = cx + (col - 2) * fw * 0.14, py = cy + (row - 1) * fh * 0.2;
                const a = (Math.floor(k / 15) % 8) / 8 * Math.PI * 2;
                d.tx = px + Math.cos(a) * 4; d.ty = py + Math.sin(a) * 4;
            }
        });

        // the focus point itself rides a stiff spring, then counts as locked once it settles
        const dt = 1 / 60;
        focus.vx += (-170 * (focus.x - gx) - 22 * focus.vx) * dt;
        focus.vy += (-170 * (focus.y - gy) - 22 * focus.vy) * dt;
        focus.x += focus.vx * dt; focus.y += focus.vy * dt;
        const still = Math.hypot(focus.vx, focus.vy) < 25;
        focus.locked = lerp(focus.locked, still ? 1 : 0, 0.12);
    }

    // the little readout under the frame, like the info line in a viewfinder
    function drawHud(t) {
        if (!vf || modeAge < 0.3) return;
        const { L, T, fw, fh } = vf;
        const size = Math.max(9, Math.min(12, fw / 34));
        ctx.font = `${size}px ${cssVar("--label-font")}`;
        ctx.textBaseline = "top";
        ctx.globalAlpha = Math.min(1, (modeAge - 0.3) * 2);
        ctx.fillStyle = colors.soft;
        const shutter = ["1/125", "1/250", "1/500"][Math.floor(t / 3) % 3];
        ctx.fillText(`f/2.8   ${shutter}   ISO 400`, L, T + fh + 12);
        // exposure meter: ticks with a needle that drifts around zero
        const mw = Math.min(110, fw * 0.3), mx = L + fw - mw, my = T + fh + 14;
        for (let i = 0; i <= 8; i++) ctx.fillRect(mx + i / 8 * mw, my + (i % 4 === 0 ? 0 : 3), 1, i % 4 === 0 ? 9 : 5);
        ctx.fillStyle = colors.accent;
        ctx.fillRect(mx + mw / 2 + Math.sin(t * 0.9) * mw * 0.18 - 1, my - 3, 2, 14);
        // af confirmation lights up once the box locks
        ctx.globalAlpha *= focus.locked;
        ctx.fillText("● AF", L, T - size - 10);
        ctx.globalAlpha = 1;
    }

    // film: a strip of three frames with sprocket holes. it sways side to side
    // instead of looping, so no dot ever has to jump back across the stage
    function filmTargets(t) {
        const cx = W / 2 + Math.sin(t * 0.9) * R * 0.18, cy = H / 2;
        const sw = R * 2.2, sh = R * 1.0;
        const left = cx - sw / 2, top = cy - sh / 2;
        dots.forEach((d, i) => {
            const part = i % 4;
            const k = Math.floor(i / 4);
            if (part === 0) {
                // the two long edges of the strip
                const u = (k % 60) / 60;
                d.tx = left + u * sw;
                d.ty = k % 120 < 60 ? top : top + sh;
            } else if (part === 1) {
                // sprocket holes, each one a tiny square of 4 dots
                const hole = Math.floor(k / 4) % 15;
                const corner = k % 4;
                const row = Math.floor(k / 60) % 2;
                d.tx = left + (hole + 0.5) / 15 * sw + (corner % 2 ? 4 : -4);
                d.ty = (row ? top + sh - 13 : top + 13) + (corner > 1 ? 3 : -3);
            } else if (part === 2) {
                // three frames inside the strip
                const f = k % 3;
                const u = (Math.floor(k / 3) % 40) / 40;
                const fx = left + sw * (0.04 + f * 0.32), fw = sw * 0.28;
                const fy = top + 26, fh = sh - 52;
                // walk around the frame's outline
                const per = 2 * (fw + fh), s = u * per;
                if (s < fw) { d.tx = fx + s; d.ty = fy; }
                else if (s < fw + fh) { d.tx = fx + fw; d.ty = fy + s - fw; }
                else if (s < 2 * fw + fh) { d.tx = fx + fw - (s - fw - fh); d.ty = fy + fh; }
                else { d.tx = fx; d.ty = fy + fh - (s - 2 * fw - fh); }
            } else {
                // loose grain drifting around the strip
                const a = i * 2.39996 + t * 0.4;
                const r = R * (0.6 + ((i * 31) % 100) / 100 * 0.7);
                d.tx = cx + Math.cos(a) * r * 1.15;
                d.ty = cy + Math.sin(a * 1.3) * r * 0.75;
            }
        });
    }

    // print: a rotating 3d wireframe page block, edges + a column grid on the face
    const cubeEdges = [
        [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7],
    ];
    function printTargets(t) {
        const cx = W / 2, cy = H / 2;
        const s = R * 0.78;
        // a page is wide and tall but thin
        const verts = [
            [-1, -1.25, -0.25], [1, -1.25, -0.25], [1, 1.25, -0.25], [-1, 1.25, -0.25],
            [-1, -1.25, 0.25], [1, -1.25, 0.25], [1, 1.25, 0.25], [-1, 1.25, 0.25],
        ];
        const ay = t * 0.5 + (mouse.on ? (mouse.x / W - 0.5) * 0.8 : 0);
        const ax = -0.35 + (mouse.on ? (mouse.y / H - 0.5) * 0.5 : 0);
        const project = ([x, y, z]) => {
            // rotate y then x, then a simple perspective divide
            let X = x * Math.cos(ay) + z * Math.sin(ay);
            let Z = -x * Math.sin(ay) + z * Math.cos(ay);
            let Y = y * Math.cos(ax) - Z * Math.sin(ax);
            Z = y * Math.sin(ax) + Z * Math.cos(ax);
            const p = 3.2 / (3.2 + Z);
            return [cx + X * s * p, cy + Y * s * p, Z];
        };
        const P = verts.map(project);
        // grid lines on the front face: 3 columns and 4 baselines
        printLines = [];
        for (let k = 1; k < 3; k++) {
            const x = -1 + k * (2 / 3);
            printLines.push([project([x, -1.25, 0.25]), project([x, 1.25, 0.25])]);
        }
        for (let k = 1; k < 5; k++) {
            const y = -1.25 + k * 0.5;
            printLines.push([project([-1, y, 0.25]), project([1, y, 0.25])]);
        }
        dots.forEach((d, i) => {
            const u = ((i * 7) % 60) / 60;
            if (i % 5 < 3) {
                // box edges
                const [a, b] = cubeEdges[i % 12];
                d.tx = lerp(P[a][0], P[b][0], u); d.ty = lerp(P[a][1], P[b][1], u); d.z = lerp(P[a][2], P[b][2], u);
            } else {
                // a 3 column grid + baselines on the front face
                // nodes sit where the grid lines cross
                const col = (i >> 1) % 3;
                const row = (i >> 3) % 5;
                const p = project([-1 + col * (2 / 3) + (i % 2 ? 0 : 0.0001), -1.25 + row * 0.625, 0.25]);
                d.tx = p[0]; d.ty = p[1]; d.z = p[2];
            }
        });
        return P;
    }

    let printVerts = null;
    let printLines = [];

    function setTargets(t) {
        printVerts = null;
        if (mode === "photo") photoTargets(t);
        else if (mode === "film") filmTargets(t);
        else printVerts = printTargets(t);
    }

    // ---- simulate + draw ----

    function draw(t) {
        const f = feel[mode];
        // film leaves trails, the other two clear the frame
        if (mode === "film" && !reduceMotion) {
            ctx.globalCompositeOperation = "destination-out";
            ctx.fillStyle = "rgba(0,0,0,.28)";
            ctx.fillRect(0, 0, W, H);
            ctx.globalCompositeOperation = "source-over";
        } else {
            ctx.clearRect(0, 0, W, H);
        }

        // print: draw the wireframe lines first so the nodes sit on top
        if (printVerts && modeAge > 0.35) {
            ctx.strokeStyle = colors.soft;
            ctx.globalAlpha = Math.min(1, (modeAge - 0.35) * 2) * 0.55;
            ctx.lineWidth = 1;
            ctx.beginPath();
            cubeEdges.forEach(([a, b]) => {
                ctx.moveTo(printVerts[a][0], printVerts[a][1]);
                ctx.lineTo(printVerts[b][0], printVerts[b][1]);
            });
            ctx.stroke();
            // the grid on the page face, in the accent colour
            ctx.strokeStyle = colors.accent;
            ctx.globalAlpha *= 0.7;
            ctx.beginPath();
            printLines.forEach(([a, b]) => { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); });
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        if (mode === "photo") drawHud(t);

        dots.forEach((d, i) => {
            const accent = i % 9 === 0;
            ctx.fillStyle = accent ? colors.accent : colors.ink;
            if (mode === "photo") {
                // thirds are faint, the focus box goes red once it locks
                const role = d.role;
                ctx.globalAlpha = role === 1 ? 0.28 : 0.95;
                ctx.fillStyle = role === 2 ? (focus.locked > 0.5 ? colors.accent : colors.ink) : role === 3 ? colors.soft : colors.ink;
                const sz = role === 0 || role === 2 ? 2.2 : 1.4;
                ctx.fillRect(d.x - sz / 2, d.y - sz / 2, sz, sz);
                return;
            }
            if (mode === "print") {
                // little square nodes, like points on a grid
                const sz = accent ? 3 : 1.8;
                ctx.globalAlpha = 0.55 + (d.z < 0 ? 0.45 : 0);
                ctx.fillRect(d.x - sz / 2, d.y - sz / 2, sz, sz);
            } else {
                const speed = Math.hypot(d.vx, d.vy);
                const sz = mode === "film" ? 1.3 + Math.min(speed / 300, 2.2) : (accent ? 2.4 : 1.5);
                ctx.globalAlpha = mode === "photo" ? 0.85 : 0.9;
                ctx.beginPath();
                ctx.arc(d.x, d.y, sz, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        ctx.globalAlpha = 1;
    }

    function step(dt, now) {
        if (!visible) return;
        const t = now / 1000;
        modeAge += dt;
        setTargets(t);
        const f = feel[mode];
        dots.forEach(d => {
            // spring toward the target
            let ax = -f.k * (d.x - d.tx) - f.c * d.vx;
            let ay = -f.k * (d.y - d.ty) - f.c * d.vy;
            // cursor pushes dots away, harder the closer they are
            if (mouse.on) {
                const dx = d.x - mouse.x, dy = d.y - mouse.y;
                const dist2 = dx * dx + dy * dy;
                const rad = R * 0.55;
                if (dist2 < rad * rad) {
                    const dist = Math.sqrt(dist2) || 1;
                    const push = (1 - dist / rad) * f.repel * 60;
                    ax += (dx / dist) * push;
                    ay += (dy / dist) * push;
                }
            }
            d.vx += ax * dt; d.vy += ay * dt;
            d.x += d.vx * dt; d.y += d.vy * dt;
        });
        draw(t);
    }

    // ---- switching modes ----

    let pillSpring = null;
    let pillX = 0, pillW = 0;

    function movePill(btn, instant) {
        const fromX = pillX, fromW = pillW;
        const toX = btn.offsetLeft, toW = btn.offsetWidth;
        if (pillSpring) pillSpring.stop();
        if (instant) {
            pillX = toX; pillW = toW;
            pill.style.transform = `translateX(${toX}px)`;
            pill.style.width = toW + "px";
            return;
        }
        // a bouncy spring so the pill overshoots a little and settles
        pillSpring = spring({
            stiffness: 320, damping: 18,
            onUpdate: p => {
                pillX = lerp(fromX, toX, p); pillW = lerp(fromW, toW, p);
                pill.style.transform = `translateX(${pillX}px)`;
                pill.style.width = pillW + "px";
            },
        });
    }

    function setMode(next, instant) {
        mode = next;
        modeAge = 0;
        heroStage.dataset.mode = next;
        tabs.forEach(b => b.setAttribute("aria-selected", String(b.dataset.mode === next)));
        movePill(tabs.find(b => b.dataset.mode === next), instant);
        $("span", caption).textContent = next[0].toUpperCase() + next.slice(1);
        caption.lastChild.textContent = " — " + feel[next].label;

        // film kicks every dot outward so the swarm feels kinetic straight away
        if (next === "film") dots.forEach(d => { d.vx += (Math.random() - 0.5) * 900; d.vy += (Math.random() - 0.5) * 900; });
        if (reduceMotion) { setTargets(0); dots.forEach(d => { d.x = d.tx; d.y = d.ty; }); draw(0); }
    }

    tabs.forEach(b => b.addEventListener("click", () => { userPicked = true; setMode(b.dataset.mode); }));

    // arrow keys move between the tabs like a normal tablist
    $(".mode-switch", heroStage).addEventListener("keydown", e => {
        if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
        const i = tabs.findIndex(b => b.dataset.mode === mode);
        const n = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
        n.focus(); n.click();
    });

    canvas.addEventListener("pointermove", e => {
        const r = canvas.getBoundingClientRect();
        mouse = { x: e.clientX - r.left, y: e.clientY - r.top, on: true };
    });
    canvas.addEventListener("pointerleave", () => { mouse.on = false; });
    // on a phone there's no hover, so a tap puts the focus (or the push) where you touched
    canvas.addEventListener("pointerdown", e => {
        const r = canvas.getBoundingClientRect();
        mouse = { x: e.clientX - r.left, y: e.clientY - r.top, on: true };
        if (e.pointerType === "touch") setTimeout(() => { mouse.on = false; }, 1400);
    });

    // it cycles on its own until someone picks a mode
    setInterval(() => {
        if (userPicked || !visible || reduceMotion) return;
        const order = ["photo", "film", "print"];
        setMode(order[(order.indexOf(mode) + 1) % 3]);
    }, 5200);

    // only run while the hero is on screen
    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !reduceMotion) addTick(step);
    }).observe(heroStage);

    // theme studio changes the colours, so re-read them when the root style changes
    new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ["style", "data-mode", "class"] });

    // watch the stage itself, phones change size when the address bar slides away
    new ResizeObserver(() => resize()).observe(canvas);

    readColors();
    resize();
    // start every dot in the middle so the first thing you see is it opening up
    dots.forEach(d => { d.x = W / 2; d.y = H / 2; });
    focus.x = W / 2; focus.y = H / 2;
    setMode("photo", true);
    if (!reduceMotion) addTick(step);
}


// ---------- crossed tapes (disciplines) ----------

// the links row runs left and the label row runs right. scrolling speeds both up,
// scrolling back up flips them.
// hovering slows it down so a word is easy to hit, but it never stops
const tapes = $$(".marquee .marquee-track, .marquee .tape-track");

if (tapes.length && !reduceMotion) {
    const bar = $(".marquee");
    const state = tapes.map(el => ({ el, x: 0, dir: el.classList.contains("tape-track") ? 1 : -1, base: el.classList.contains("tape-track") ? 26 : 42 }));
    let lastY = scrollY;
    let push = 0;          // smoothed scroll speed
    let flip = 1;          // 1 normal, -1 after scrolling up. eased so it turns around, not snaps
    let flipTo = 1;
    let hover = 1;
    let onScreen = true;

    addEventListener("scroll", () => {
        const dy = scrollY - lastY;
        lastY = scrollY;
        push = Math.min(push + Math.abs(dy) * 0.9, 900);
        if (Math.abs(dy) > 2) flipTo = dy > 0 ? 1 : -1;
    }, { passive: true });

    bar.addEventListener("pointerenter", () => { hover = 0.4; });
    bar.addEventListener("pointerleave", () => { hover = 1; });
    new IntersectionObserver(([e]) => {
        onScreen = e.isIntersecting;
        if (onScreen) addTick(run);
    }).observe(bar);

    function run(dt) {
        if (!onScreen) return false;
        push *= Math.pow(0.04, dt); // scroll boost fades out in about a second
        flip = lerp(flip, flipTo, Math.min(1, dt * 4));
        const speed = (1 + push / 60) * hover;
        state.forEach(s => {
            // each track holds two copies, so wrapping at half its width loops seamlessly
            const half = s.el.scrollWidth / 2;
            s.x += s.dir * flip * s.base * speed * dt;
            if (s.x <= -half) s.x += half;
            if (s.x > 0) s.x -= half;
            s.el.style.transform = `translateX(${s.x}px)`;
        });
    }
    // the print proof starts part way through so its words don't line up with the film frames
    state.filter(s => s.dir > 0).forEach(s => { s.x = -s.el.scrollWidth * 0.18; });
    addTick(run);
}


// ---------- shared-element morph: card -> case study ----------

// when a case card is clicked, a copy of its image and title springs out of the
// card and lands where the case study header sits in the drawer. then the real
// drawer content fades in underneath and the copy fades away
function morphToDrawer(card) {
    if (reduceMotion) return;
    const img = $(".thumb img", card);
    const title = $("h3", card);
    if (!img || !title) return;

    const from = img.getBoundingClientRect();
    const fromT = title.getBoundingClientRect();
    const fromSize = parseFloat(getComputedStyle(title).fontSize);

    // first guess at where it lands, used until the real case study has loaded
    const panelW = Math.min(980, innerWidth);
    const panelX = innerWidth - panelW;
    const pad = innerWidth < 700 ? 20 : 40;
    const guessT = { left: panelX + pad, top: 57 + 70, size: Math.min(56, innerWidth * 0.07) };
    const guess = { left: panelX + pad, top: guessT.top + 260, width: panelW - pad * 2, height: Math.min(innerHeight * 0.5, panelW * 0.5) };

    // once the drawer content exists, measure the real title and cover and aim for those
    function measured() {
        const h1 = $(".drawer-body .case-hero h1");
        const cover = $(".drawer-body .case-cover img, .drawer-body .case-cover video, .drawer-body figure img");
        if (!h1 || !cover) return null;
        const r = cover.getBoundingClientRect();
        const t = h1.getBoundingClientRect();
        if (!r.width || !t.width) return null;
        // copy the heading's spacing so the copy's text sits on the same baseline
        if (!gTitle.dataset.fitted) {
            const cs = getComputedStyle(h1);
            const ratio = guessT.size / parseFloat(cs.fontSize);
            gTitle.style.lineHeight = parseFloat(cs.lineHeight) * ratio + "px";
            gTitle.style.letterSpacing = parseFloat(cs.letterSpacing || 0) * ratio + "px";
            gTitle.style.fontWeight = cs.fontWeight;
            gTitle.dataset.fitted = "1";
        }
        return {
            img: { left: r.left, top: r.top, width: r.width, height: r.height },
            title: { left: t.left, top: t.top, size: parseFloat(getComputedStyle(h1).fontSize) },
        };
    }

    const ghost = document.createElement("div");
    ghost.className = "morph-ghost";
    ghost.innerHTML = `<div class="mg-img"><img src="${img.currentSrc || img.src}" alt=""></div><h3 class="mg-title">${title.innerHTML}</h3>`;
    body.appendChild(ghost);
    const gImg = $(".mg-img", ghost);
    const gTitle = $(".mg-title", ghost);

    // both pieces are laid out once at a base size and only ever moved with transform
    const base = guess;
    Object.assign(gImg.style, { left: "0px", top: "0px", width: base.width + "px", height: base.height + "px" });
    Object.assign(gTitle.style, { left: "0px", top: "0px", fontSize: guessT.size + "px" });

    // the target glides from the guess to the measured spot, so a late load never jumps
    let to = { ...guess };
    let toT = { ...guessT };
    let landed = false;
    let p = 0;

    card.classList.add("morph-source");
    drawer.classList.add("morphing");

    function paint() {
        const real = measured();
        if (real) {
            ["left", "top", "width", "height"].forEach(k => { to[k] = lerp(to[k], real.img[k], 0.3); });
            ["left", "top", "size"].forEach(k => { toT[k] = lerp(toT[k], real.title[k], 0.3); });
        }
        // the title runs slightly ahead of the image, it reads more natural
        const q = 1 - (1 - p) * 0.92;
        const x = lerp(from.left, to.left, p), y = lerp(from.top, to.top, p);
        const w = lerp(from.width, to.width, p), h = lerp(from.height, to.height, p);
        // size it for real instead of scaling, scaling squashed the photo while it flew
        gImg.style.width = w + "px";
        gImg.style.height = h + "px";
        gImg.style.transform = `translate(${x}px, ${y}px)`;
        gImg.style.borderRadius = `${lerp(14, 6, Math.min(1, p))}px`;
        const tx = lerp(fromT.left, toT.left, q), ty = lerp(fromT.top, toT.top, q);
        const size = lerp(fromSize, toT.size, Math.min(1, q));
        gTitle.style.transform = `translate(${tx}px, ${ty}px) scale(${size / guessT.size})`;
        return real;
    }
    paint();

    function finish() {
        drawer.classList.remove("morphing");
        ghost.classList.add("out");
        card.classList.remove("morph-source");
        setTimeout(() => ghost.remove(), 350);
    }

    // elastic: moderate stiffness, low-ish damping so it lands with a small bounce
    spring({
        stiffness: 210, damping: 21,
        onUpdate: v => { p = v; paint(); },
        onDone: () => {
            landed = true;
            // if the case study is still loading, hold the copy in place until it arrives
            const started = performance.now();
            addTick(() => {
                const real = paint();
                if (real || performance.now() - started > 1500) {
                    // give the target a few frames to finish gliding before handing over
                    if (!real || Math.abs(to.top - real.img.top) < 1) { finish(); return false; }
                }
            });
        },
    });
}


// ---------- liquid ripple + rgb split on photo thumbnails (webgl) ----------

// one webgl canvas is shared by every photo tile. on hover it sits over that tile's
// image and redraws it with a ripple and a colour split that follow the cursor speed
if (hoverPointer && !reduceMotion) {
    const gl_canvas = document.createElement("canvas");
    gl_canvas.className = "liquid-layer";
    const gl = gl_canvas.getContext("webgl", { premultipliedAlpha: false, antialias: false });

    if (gl) {
        body.appendChild(gl_canvas);

        const vert = `
            attribute vec2 p;
            varying vec2 uv;
            void main() { uv = p * 0.5 + 0.5; uv.y = 1.0 - uv.y; gl_Position = vec4(p, 0.0, 1.0); }`;

        // ripple rings spread out from the cursor, the colour channels get pulled
        // apart along the direction the cursor is moving. strength fades when it stops
        const frag = `
            precision mediump float;
            varying vec2 uv;
            uniform sampler2D img;
            uniform vec2 mouse;
            uniform vec2 vel;
            uniform float strength;
            uniform float time;
            uniform vec2 cover;
            uniform vec2 offset;
            void main() {
                vec2 st = uv;
                float d = distance(st, mouse);
                float ring = sin(d * 38.0 - time * 7.0) * exp(-d * 5.0);
                vec2 dir = normalize(st - mouse + 0.0001);
                st += dir * ring * 0.018 * strength;
                vec2 split = vel * 0.005 * strength;
                vec2 base = st * cover + offset;
                float r = texture2D(img, base + split).r;
                float g = texture2D(img, base).g;
                float b = texture2D(img, base - split).b;
                gl_FragColor = vec4(r, g, b, 1.0);
            }`;

        const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
        const prog = gl.createProgram();
        gl.attachShader(prog, sh(gl.VERTEX_SHADER, vert));
        gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, frag));
        gl.linkProgram(prog);
        gl.useProgram(prog);

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, "p");
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        const U = name => gl.getUniformLocation(prog, name);
        const u = { mouse: U("mouse"), vel: U("vel"), strength: U("strength"), time: U("time"), cover: U("cover"), offset: U("offset") };

        let active = null;
        let m = { x: 0.5, y: 0.5 }, lastM = { x: 0.5, y: 0.5 };
        let vel = { x: 0, y: 0 };
        let strength = 0;

        function place() {
            const media = $(".media", active);
            const r = media.getBoundingClientRect();
            const d = Math.min(devicePixelRatio || 1, 2);
            Object.assign(gl_canvas.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
            if (gl_canvas.width !== Math.round(r.width * d)) {
                gl_canvas.width = Math.round(r.width * d);
                gl_canvas.height = Math.round(r.height * d);
                gl.viewport(0, 0, gl_canvas.width, gl_canvas.height);
            }
            // match object-fit: cover so the shader shows the same crop as the img
            const img = $("img", active);
            const ia = img.naturalWidth / img.naturalHeight;
            const ba = r.width / r.height;
            const cover = ia > ba ? [ba / ia, 1] : [1, ia / ba];
            gl.uniform2f(u.cover, cover[0], cover[1]);
            gl.uniform2f(u.offset, (1 - cover[0]) / 2, (1 - cover[1]) / 2);
        }

        function tick(dt, now) {
            if (!active) return false;
            // velocity is smoothed so the split eases in and out instead of flickering
            const vx = (m.x - lastM.x) / Math.max(dt, 0.001);
            const vy = (m.y - lastM.y) / Math.max(dt, 0.001);
            vel.x = lerp(vel.x, vx, 0.15);
            vel.y = lerp(vel.y, vy, 0.15);
            lastM = { ...m };
            const speed = Math.min(Math.hypot(vel.x, vel.y), 2.5);
            strength = lerp(strength, speed, 0.08);
            place();
            gl.uniform2f(u.mouse, m.x, m.y);
            gl.uniform2f(u.vel, vel.x, vel.y);
            gl.uniform1f(u.strength, strength);
            gl.uniform1f(u.time, now / 1000);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        $$(".shoots .tile").forEach(tile => {
            const img = $("img", tile);
            tile.addEventListener("pointerenter", () => {
                if (!img.complete || !img.naturalWidth) return;
                active = tile;
                gl.bindTexture(gl.TEXTURE_2D, tex);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                strength = 0;
                gl_canvas.classList.add("on");
                addTick(tick);
            });
            tile.addEventListener("pointermove", e => {
                const r = $(".media", tile).getBoundingClientRect();
                m = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
            });
            tile.addEventListener("pointerleave", () => {
                active = null;
                gl_canvas.classList.remove("on");
            });
        });
        // scrolling while hovering would leave the canvas behind, so drop it
        addEventListener("scroll", () => { if (active) { active = null; gl_canvas.classList.remove("on"); } }, { passive: true });
    }
}


// ---------- lens cursor ----------

// a dot that sits exactly on the pointer and a ring that chases it on a spring.
// the ring stretches in the direction it's moving, wraps around buttons, and
// over film work it opens into a round window playing that clip
if (hoverPointer && !reduceMotion) {
    const dot = document.createElement("div");
    dot.className = "cursor-dot";
    const ring = document.createElement("div");
    ring.className = "cursor-ring";
    ring.innerHTML = '<video muted loop playsinline preload="none"></video><span class="cursor-label"></span>';
    body.append(ring, dot);
    body.classList.add("has-cursor");

    const vid = $("video", ring);
    const label = $(".cursor-label", ring);
    let mx = innerWidth / 2, my = innerHeight / 2;
    let rx = mx, ry = my, vx = 0, vy = 0;
    let size = 34, sizeV = 0, targetSize = 34;
    let snap = null;
    let lensOn = false;

    addEventListener("pointermove", e => {
        mx = e.clientX; my = e.clientY;
        dot.style.transform = `translate(${mx}px, ${my}px)`;
    }, { passive: true });

    document.addEventListener("pointerleave", () => { ring.style.opacity = 0; dot.style.opacity = 0; });
    document.addEventListener("pointerenter", () => { ring.style.opacity = ""; dot.style.opacity = ""; });

    // what is the pointer over right now
    document.addEventListener("pointerover", e => {
        const film = e.target.closest(".reel .tile, [data-preview]");
        const hit = e.target.closest("a, button, .tile, .cf-card, input, label, [role=tab]");
        if (film) {
            const src = film.dataset.preview || film.dataset.full.split(",")[0].trim();
            if (src.endsWith(".mp4")) {
                if (!vid.src.endsWith(src)) { vid.src = src; }
                vid.play().catch(() => {});
                lensOn = true;
                ring.classList.add("lens");
                label.textContent = film.matches("[data-preview]") ? "Open case" : "Play";
                targetSize = 170;
                snap = null;
                return;
            }
        }
        lensOn = false;
        ring.classList.remove("lens");
        vid.pause();
        if (hit && hit.matches(".btn, .mode-switch button, .nav a, .icon-btn, .lb-btn, .chip, .filters button")) {
            // wrap the ring around small controls, and pull it toward their centre
            snap = hit;
            const r = hit.getBoundingClientRect();
            targetSize = Math.max(r.height, 34) + 14;
        } else {
            snap = null;
            targetSize = hit ? 54 : 34;
        }
        ring.classList.toggle("hover", !!hit);
    });

    // the ring spring runs every frame
    addTick(dt => {
        let tx = mx, ty = my;
        if (snap && snap.isConnected) {
            const r = snap.getBoundingClientRect();
            // magnetic: sits between the pointer and the control's centre
            tx = lerp(mx, r.left + r.width / 2, 0.45);
            ty = lerp(my, r.top + r.height / 2, 0.45);
        }
        const k = 520, c = 34;
        vx += (-k * (rx - tx) - c * vx) * dt;
        vy += (-k * (ry - ty) - c * vy) * dt;
        rx += vx * dt; ry += vy * dt;
        // size has its own bouncier spring so the lens pops open
        sizeV += (-260 * (size - targetSize) - 20 * sizeV) * dt;
        size += sizeV * dt;
        // stretch along the direction of travel, capped so it never gets silly
        const speed = Math.hypot(vx, vy);
        const stretch = lensOn ? 0 : Math.min(speed / 2600, 0.45);
        const angle = Math.atan2(vy, vx);
        ring.style.width = ring.style.height = size + "px";
        ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%) rotate(${angle}rad) scale(${1 + stretch}, ${1 - stretch * 0.6})`;
        $("video", ring).style.transform = `rotate(${-angle}rad)`;
        label.style.transform = `translate(-50%, -50%) rotate(${-angle}rad)`;
    });
}
