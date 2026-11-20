// reveal.js
// the intro that plays when the portfolio first opens. there are four of them,
// pick one with ?reveal=shutter | leader | darkroom | contact (or none).
// without the link it plays REVEAL_DEFAULT once per visit. click or any key skips it.

const REVEAL_DEFAULT = "shutter";
const REVEALS = ["shutter", "leader", "darkroom", "contact"];

(function () {
    // the head script hides the page until this decides what to do, so always unhide it
    const unhide = () => document.documentElement.classList.remove("reveal-pending");
    const asked = new URLSearchParams(location.search).get("reveal");
    // automated test browsers skip it so they can click straight away
    if (navigator.webdriver && !asked) return unhide();
    let seen = false;
    try { seen = !!sessionStorage.getItem("revealed"); } catch (e) {}
    const pick = asked || (seen ? "none" : REVEAL_DEFAULT);
    if (!REVEALS.includes(pick)) return unhide();
    try { sessionStorage.setItem("revealed", "1"); } catch (e) {}

    const html = document.documentElement;
    const layer = document.createElement("div");
    layer.className = "reveal-layer";
    layer.setAttribute("aria-hidden", "true");
    const canvas = document.createElement("canvas");
    layer.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    document.body.appendChild(layer);
    html.classList.add("revealing", "reveal-" + pick);
    unhide();

    let W = 0, H = 0, dpr = 1;
    function size() {
        dpr = Math.min(devicePixelRatio || 1, 2);
        W = innerWidth; H = innerHeight;
        canvas.width = W * dpr; canvas.height = H * dpr;
        canvas.style.width = W + "px"; canvas.style.height = H + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    addEventListener("resize", size);

    const css = name => getComputedStyle(html).getPropertyValue(name).trim();
    const accent = css("--accent") || "#e63027";
    const ease = t => 1 - Math.pow(1 - t, 3);
    const easeIn = t => t * t * t;
    const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

    let done = false;
    function finish() {
        if (done) return;
        done = true;
        layer.classList.add("out");
        html.classList.remove("revealing");
        setTimeout(() => { layer.remove(); html.classList.remove("reveal-" + pick); }, 500);
    }
    // skipping is always one click or key away
    addEventListener("keydown", finish, { once: true });
    layer.addEventListener("pointerdown", finish);

    // ---------- 1. shutter: aperture blades open up from black ----------
    function shutter(t) {
        const total = 2.1;
        ctx.clearRect(0, 0, W, H);
        const cx = W / 2, cy = H / 2;
        const maxR = Math.hypot(W, H) / 2 + 40;
        // holds closed for a beat with the readout, then snaps open
        const open = ease(clamp((t - 0.75) / 1.1));
        const r = 6 + open * maxR;
        const spin = open * 1.1;
        ctx.fillStyle = "#0b0b0b";
        ctx.fillRect(0, 0, W, H);
        // cut the hexagon out of the black
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = spin + i / 6 * Math.PI * 2;
            ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        // blade edges run from each corner of the hole out to the screen edge
        ctx.strokeStyle = "rgba(255,255,255,.18)";
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
            const a = spin + i / 6 * Math.PI * 2;
            const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
            const b = a + Math.PI / 2 + 0.35;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(b) * maxR * 2, y + Math.sin(b) * maxR * 2);
            ctx.stroke();
        }
        // readout fades as the blades open
        const a = 1 - clamp(open * 3);
        if (a > 0) {
            ctx.globalAlpha = a;
            ctx.fillStyle = "#f3efe7";
            ctx.textAlign = "center";
            ctx.font = `600 ${Math.min(44, W / 12)}px ${css("--heading-font") || "sans-serif"}`;
            ctx.fillText("Omar El Sadek", cx, cy - 40);
            ctx.font = `13px ${css("--label-font") || "monospace"}`;
            ctx.fillStyle = accent;
            const fstop = ["f/16", "f/8", "f/4", "f/2.8", "f/1.8"][Math.min(4, Math.floor(t / 0.16))];
            ctx.fillText(`${fstop}   1/250   ISO 400`, cx, cy + 60);
            ctx.globalAlpha = 1;
        }
        return t > total;
    }

    // ---------- 2. film leader: 3 2 1 countdown with the sweeping hand ----------
    function leader(t) {
        const per = 0.55;
        const total = per * 3 + 0.35;
        const cx = W / 2, cy = H / 2;
        const R = Math.min(W, H) * 0.32;
        ctx.fillStyle = "#1a1714";
        ctx.fillRect(0, 0, W, H);
        if (t < per * 3) {
            const n = 3 - Math.floor(t / per);
            const p = (t % per) / per;
            // the sweep fills in like old film leader
            ctx.fillStyle = "#2b2622";
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, R * 1.6, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "#cfc6b8";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(cx, cy, R * 0.82, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
            ctx.fillStyle = "#f3efe7";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = `700 ${R * 1.1}px ${css("--heading-font") || "sans-serif"}`;
            ctx.fillText(n, cx, cy + R * 0.05);
            ctx.textBaseline = "alphabetic";
        } else {
            // a white flash frame, then cut to the page
            const f = clamp((t - per * 3) / 0.35);
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = `rgba(255,255,255,${1 - f})`;
            ctx.fillRect(0, 0, W, H);
        }
        // grain and a couple of scratches on every frame
        if (t < per * 3) {
            for (let i = 0; i < 260; i++) {
                ctx.fillStyle = Math.random() > .5 ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.18)";
                ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
            }
            ctx.fillStyle = "rgba(255,255,255,.12)";
            ctx.fillRect((t * 997 % 1) * W, 0, 1, H);
        }
        return t > total;
    }

    // ---------- 3. darkroom: the page develops under the red safelight ----------
    function darkroom(t) {
        const total = 2.4;
        const p = clamp(t / total);
        // the page itself is greyed and blown out by css, the class comes off as it develops
        html.style.setProperty("--develop", p.toFixed(3));
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = `rgba(150, 10, 10, ${0.72 * (1 - ease(p))})`;
        ctx.fillRect(0, 0, W, H);
        const a = 1 - clamp(p * 2.2);
        if (a > 0) {
            ctx.globalAlpha = a;
            ctx.fillStyle = "#ffd8d0";
            ctx.textAlign = "center";
            ctx.font = `13px ${css("--label-font") || "monospace"}`;
            ctx.fillText("DEVELOPING  ·  " + String(Math.floor(p * 100)).padStart(2, "0") + "%", W / 2, H - 48);
            ctx.globalAlpha = 1;
        }
        return t > total;
    }

    // ---------- 4. contact sheet: frames fill a sheet, one gets circled, it opens the page ----------
    // the page lazy-loads its photos, so the sheet loads its own copies straight away
    const frames = pick === "contact"
        ? [...document.querySelectorAll(".shoots .tile img, .bento-card .thumb img")].slice(0, 15).map(el => {
            const img = new Image();
            img.src = el.currentSrc || el.src;
            return img;
        })
        : [];
    function contactSheet(t) {
        const total = 3.1;
        const cols = W > 700 ? 5 : 3, rows = 3;
        const pad = 14;
        const cw = (W - pad * (cols + 1)) / cols;
        const ch = Math.min((H - pad * (rows + 1) - 60) / rows, cw * 0.7);
        const top = (H - (ch * rows + pad * (rows - 1))) / 2;
        const pickI = Math.min(frames.length, cols * rows) > 7 ? 7 : 0;
        const zoom = easeIn(clamp((t - 2.2) / 0.9));
        ctx.fillStyle = "#121212";
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1 - zoom;
        for (let i = 0; i < cols * rows; i++) {
            const appear = clamp((t - i * 0.05) / 0.25);
            if (!appear) continue;
            const x = pad + (i % cols) * (cw + pad), y = top + Math.floor(i / cols) * (ch + pad);
            ctx.globalAlpha = appear * (1 - zoom);
            const img = frames[i % Math.max(1, frames.length)];
            if (img && img.complete && img.naturalWidth) {
                const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
                const sw = cw / s, sh = ch / s;
                ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, cw, ch);
            } else {
                ctx.fillStyle = "#2a2a2a";
                ctx.fillRect(x, y, cw, ch);
            }
            ctx.fillStyle = "#f5a623";
            ctx.font = `10px ${css("--label-font") || "monospace"}`;
            ctx.fillText(String(i + 1).padStart(2, "0") + "A", x, y + ch + 11);
        }
        // the grease pencil circle around the keeper
        const circle = clamp((t - 1.1) / 0.6);
        if (circle && zoom < 1) {
            const i = pickI;
            const x = pad + (i % cols) * (cw + pad) + cw / 2, y = top + Math.floor(i / cols) * (ch + pad) + ch / 2;
            ctx.globalAlpha = 1 - zoom;
            ctx.strokeStyle = accent;
            ctx.lineWidth = 4;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.ellipse(x, y, cw * 0.62, ch * 0.66, -0.08, -Math.PI / 2, -Math.PI / 2 + circle * Math.PI * 2.1);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // then the whole sheet fades through into the page
        if (zoom > 0) {
            ctx.fillStyle = `rgba(18,18,18,${1 - zoom})`;
            ctx.clearRect(0, 0, W, H);
            ctx.fillRect(0, 0, W, H);
        }
        return t > total;
    }

    const run = { shutter, leader, darkroom, contact: contactSheet }[pick];
    const start = performance.now();
    function loop(now) {
        if (done) return;
        const t = (now - start) / 1000;
        let over = false;
        try { over = run(t); } catch (e) { over = true; console.warn("reveal stopped:", e); }
        if (over) finish(); else requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
})();
