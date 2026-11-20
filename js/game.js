// game.js
// "catch the shot": a car crosses the viewfinder and you fire the shutter when it's
// inside the focus box. closer to the middle = more points. faster cars blur more,
// so timing matters. 5 shots a roll, best roll is saved in this browser.

(function () {
    const box = document.querySelector(".game");
    if (!box) return;
    const canvas = box.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const shutterBtn = box.querySelector(".game-shutter");
    const startBtn = box.querySelector(".game-start");
    const readout = box.querySelector(".game-readout");
    const bestEl = box.querySelector(".game-best");
    const rollEl = box.querySelector(".game-roll");

    const SHOTS = 5;
    let W = 0, H = 0, dpr = 1;
    let state = "idle";          // idle -> driving -> frozen -> (next car or done)
    let car = null;
    let shots = [];
    let frozenAt = 0;
    let last = performance.now();
    let best = 0;
    try { best = Number(localStorage.getItem("catch-best") || 0); } catch (e) {}

    const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const colors = () => ({ accent: css("--accent") || "#e63027", ink: "#f3efe7", soft: "rgba(243,239,231,.45)" });

    function size() {
        const r = canvas.getBoundingClientRect();
        dpr = Math.min(devicePixelRatio || 1, 2);
        W = r.width; H = r.height;
        canvas.width = W * dpr; canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw();
    }

    // ---------- the scene ----------

    // a strip of city lights that never changes, so it's built once
    const city = Array.from({ length: 70 }, (_, i) => ({ x: i / 70, w: 0.008 + Math.random() * 0.02, h: 0.12 + Math.random() * 0.3, lit: Math.random() }));

    function newCar() {
        const n = shots.length;
        // each car is a bit faster than the last, and it sometimes comes from the right
        const dir = Math.random() > 0.5 ? 1 : -1;
        const speed = (0.5 + n * 0.14 + Math.random() * 0.1) * W;
        car = { dir, speed, x: dir > 0 ? -0.15 * W : 1.15 * W, hue: ["#e63027", "#f3efe7", "#1d4ed8", "#f5a623", "#9aa3ad"][n % 5] };
        state = "driving";
    }

    function drawCar(x, y, len, col, blur) {
        const h = len * 0.28;
        // motion blur: draw the car a few times, fading, trailing behind it
        const steps = Math.max(1, Math.round(blur / 6));
        for (let s = steps; s >= 0; s--) {
            ctx.globalAlpha = s === 0 ? 1 : 0.18 / steps * (steps - s + 1);
            const ox = x - car.dir * s * (blur / steps);
            ctx.fillStyle = col;
            ctx.save();
            // draw it pointing right, then flip it when it drives the other way
            ctx.translate(ox, y);
            ctx.scale(car.dir, 1);
            ctx.beginPath();
            // low coupe silhouette: tall at the back, long sloped nose at the front
            ctx.moveTo(-len / 2, 0);
            ctx.lineTo(-len / 2, -h * 0.5);
            ctx.quadraticCurveTo(-len * 0.3, -h * 0.62, -len * 0.18, -h);
            ctx.lineTo(len * 0.06, -h);
            ctx.quadraticCurveTo(len * 0.22, -h * 0.6, len / 2, -h * 0.34);
            ctx.lineTo(len / 2, 0);
            ctx.closePath();
            ctx.fill();
            // window line and a red tail light at the back
            ctx.fillStyle = "rgba(10,12,20,.75)";
            ctx.beginPath();
            ctx.moveTo(-len * 0.16, -h * 0.9);
            ctx.lineTo(len * 0.04, -h * 0.9);
            ctx.quadraticCurveTo(len * 0.14, -h * 0.66, len * 0.2, -h * 0.58);
            ctx.lineTo(-len * 0.24, -h * 0.58);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#ff2a2a";
            ctx.fillRect(-len / 2, -h * 0.46, 6, h * 0.12);
            ctx.fillStyle = "#0d0d0d";
            [-0.3, 0.3].forEach(k => { ctx.beginPath(); ctx.arc(k * len, 0, h * 0.28, 0, Math.PI * 2); ctx.fill(); });
            ctx.restore();
        }
        ctx.globalAlpha = 1;
        // headlight beam in the direction it's going
        const front = x + car.dir * len / 2;
        const g = ctx.createLinearGradient(front, 0, front + car.dir * len, 0);
        g.addColorStop(0, "rgba(255,240,200,.55)");
        g.addColorStop(1, "rgba(255,240,200,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(front, y - h * 0.35);
        ctx.lineTo(front + car.dir * len, y - h * 0.65);
        ctx.lineTo(front + car.dir * len, y + h * 0.15);
        ctx.closePath();
        ctx.fill();
    }

    function draw() {
        if (!W) return;
        const c = colors();
        // night sky and city
        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, "#0c1020");
        sky.addColorStop(1, "#1b1418");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);
        const road = H * 0.78;
        city.forEach(b => {
            ctx.fillStyle = "#151824";
            ctx.fillRect(b.x * W, road - b.h * H, b.w * W, b.h * H);
            if (b.lit > 0.5) { ctx.fillStyle = "rgba(245,166,35,.55)"; ctx.fillRect(b.x * W + 3, road - b.h * H + 6, 3, 3); }
        });
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, road, W, H - road);
        ctx.fillStyle = "rgba(243,239,231,.25)";
        for (let x = 0; x < W; x += 60) ctx.fillRect(x, road + (H - road) * 0.45, 30, 3);

        // the car, frozen with blur if a shot was just taken
        if (car) {
            const len = Math.min(W * 0.26, 260);
            const blur = state === "frozen" ? shots[shots.length - 1].blur : 0;
            drawCar(car.x, road + 4, len, car.hue, blur);
        }

        // viewfinder: corners, focus box, readout
        const fw = W * 0.9, fh = H * 0.84, L = (W - fw) / 2, T = (H - fh) / 2, arm = 26;
        ctx.strokeStyle = c.ink;
        ctx.lineWidth = 2;
        [[L, T, 1, 1], [L + fw, T, -1, 1], [L, T + fh, 1, -1], [L + fw, T + fh, -1, -1]].forEach(([x, y, sx, sy]) => {
            ctx.beginPath(); ctx.moveTo(x + sx * arm, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * arm); ctx.stroke();
        });
        const bx = W / 2, bw = Math.min(W * 0.22, 210), bh = H * 0.42, by = road - bh * 0.55;
        ctx.strokeStyle = state === "frozen" ? c.accent : c.soft;
        ctx.strokeRect(bx - bw / 2, by - bh / 2, bw, bh);
        ctx.fillStyle = c.soft;
        ctx.font = `11px ${css("--label-font") || "monospace"}`;
        ctx.textAlign = "left";
        ctx.fillText(`SHOT ${Math.min(shots.length + (state === "driving" ? 1 : 0), SHOTS)}/${SHOTS}   1/${state === "driving" ? 250 : 250}   ISO 3200`, L + 10, T + fh - 10);

        // flash right after the shutter
        if (state === "frozen") {
            const f = Math.max(0, 1 - (performance.now() - frozenAt) / 180);
            if (f) { ctx.fillStyle = `rgba(255,255,255,${f * 0.7})`; ctx.fillRect(0, 0, W, H); }
            const s = shots[shots.length - 1];
            ctx.textAlign = "center";
            ctx.font = `700 ${Math.min(42, W / 14)}px ${css("--heading-font") || "sans-serif"}`;
            ctx.fillStyle = s.points >= 80 ? c.accent : c.ink;
            ctx.fillText(s.grade, W / 2, T + 54);
            ctx.font = `12px ${css("--label-font") || "monospace"}`;
            ctx.fillStyle = c.ink;
            ctx.fillText(`+${s.points}`, W / 2, T + 76);
        }
        if (state === "idle" || state === "done") {
            ctx.fillStyle = "rgba(0,0,0,.45)";
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = c.ink;
            ctx.textAlign = "center";
            ctx.font = `600 ${Math.min(30, W / 18)}px ${css("--heading-font") || "sans-serif"}`;
            ctx.fillText(state === "done" ? `Roll done: ${total()} points` : "Catch the Shot", W / 2, H / 2 - 8);
            ctx.font = `12px ${css("--label-font") || "monospace"}`;
            ctx.fillText(state === "done" ? "load another roll to beat it" : "fire when the car is in the box", W / 2, H / 2 + 18);
        }
    }

    const total = () => shots.reduce((a, s) => a + s.points, 0);

    function updateText() {
        rollEl.innerHTML = Array.from({ length: SHOTS }, (_, i) => {
            const s = shots[i];
            return `<span class="${s ? (s.points >= 80 ? "hit" : s.points ? "ok" : "miss") : ""}">${s ? s.points : "&middot;"}</span>`;
        }).join("");
        bestEl.textContent = best ? `Best roll: ${best}` : "No best roll yet";
    }

    // ---------- taking the shot ----------

    function fire() {
        if (state !== "driving") return;
        const off = Math.abs(car.x - W / 2) / (Math.min(W * 0.22, 210) / 2); // 0 = dead centre, 1 = box edge
        const blur = car.speed / W * 26; // faster car, more blur in the frozen frame
        let points = 0, grade = "Missed it";
        if (off <= 1) {
            points = Math.round(100 * (1 - off * 0.6) - blur * 0.8);
            points = Math.max(10, points);
            grade = points >= 85 ? "Tack sharp" : points >= 65 ? "Keeper" : "A bit soft";
        }
        shots.push({ points, grade, blur });
        state = "frozen";
        frozenAt = performance.now();
        readout.textContent = `${grade}${points ? `, +${points}` : ""}`;
        updateText();
        setTimeout(() => {
            if (shots.length >= SHOTS) {
                state = "done";
                car = null;
                if (total() > best) { best = total(); try { localStorage.setItem("catch-best", best); } catch (e) {} }
                readout.textContent = `Roll done: ${total()} points`;
                startBtn.textContent = "Load another roll";
                startBtn.hidden = false;
                shutterBtn.disabled = true;
                updateText();
            } else newCar();
        }, 900);
    }

    function start() {
        shots = [];
        updateText();
        readout.textContent = "Wait for it...";
        startBtn.hidden = true;
        shutterBtn.disabled = false;
        newCar();
        shutterBtn.focus();
    }

    function tick(now) {
        const dt = Math.min((now - last) / 1000, 1 / 30);
        last = now;
        if (state === "driving") {
            car.x += car.dir * car.speed * dt;
            // drove out of frame without a shot = a miss
            // how far from the middle it is, kept on the element so the page tests can aim
            box.dataset.off = (Math.abs(car.x - W / 2) / (Math.min(W * 0.22, 210) / 2)).toFixed(2);
            if ((car.dir > 0 && car.x > W * 1.2) || (car.dir < 0 && car.x < -W * 0.2)) {
                car.x = W * 10;
                fire();
            }
        }
        draw();
        requestAnimationFrame(tick);
    }

    startBtn.addEventListener("click", start);
    shutterBtn.addEventListener("click", fire);
    canvas.addEventListener("pointerdown", () => { if (state === "driving") fire(); else if (state !== "frozen") start(); });
    // space fires, but only while the game is on screen so it doesn't hijack scrolling
    let onScreen = false;
    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }, { threshold: 0.5 }).observe(box);
    addEventListener("keydown", e => {
        if (!onScreen || e.code !== "Space" || e.target.closest("input, textarea")) return;
        e.preventDefault();
        if (state === "driving") fire(); else if (state === "idle" || state === "done") start();
    });

    new ResizeObserver(size).observe(canvas);
    updateText();
    requestAnimationFrame(tick);
})();
