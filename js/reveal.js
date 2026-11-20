// reveal.js
// the lens intro. the page opens behind a closed aperture and the blades open as you scroll
// (wheel, trackpad, swipe or the arrow / space keys). scroll back up and they close again.
// once it's fully open the page lets go and scrolls normally. click opens it all the way.
// plays once per visit, replay it with ?reveal=shutter, turn it off with ?reveal=none

(function () {
    const html = document.documentElement;
    // the head script hides the page until this decides what to do, so always unhide it
    const unhide = () => html.classList.remove("reveal-pending");
    const asked = new URLSearchParams(location.search).get("reveal");
    // automated test browsers skip it so they can click straight away
    if (navigator.webdriver && !asked) return unhide();
    let seen = false;
    try { seen = !!sessionStorage.getItem("revealed"); } catch (e) {}
    if (asked === "none" || (!asked && seen)) return unhide();
    try { sessionStorage.setItem("revealed", "1"); } catch (e) {}

    // ---------- setup ----------

    const layer = document.createElement("div");
    layer.className = "reveal-layer";
    layer.setAttribute("aria-hidden", "true");
    const canvas = document.createElement("canvas");
    const hint = document.createElement("span");
    hint.className = "reveal-hint label";
    hint.textContent = "scroll to open the lens";
    layer.append(canvas, hint);
    const ctx = canvas.getContext("2d");
    document.body.appendChild(layer);
    scrollTo(0, 0);
    html.classList.add("revealing");
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
    const accent = css("--accent") || "#e8262d";
    const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
    const ease = t => 1 - Math.pow(1 - t, 3);

    // ---------- scroll input ----------

    // how far you need to scroll to open it all the way (about a screen and a half)
    const TRAVEL = () => H * 1.4;
    let target = 0;   // where the scroll says it should be, 0 closed to 1 open
    let open = 0;     // eased towards target every frame so it feels smooth
    let done = false;

    function push(px) {
        if (done) return;
        target = clamp(target + px / TRAVEL());
    }

    const onWheel = e => {
        e.preventDefault();
        // line mode (old mice) reports in lines, not pixels
        push(e.deltaY * (e.deltaMode === 1 ? 32 : 1));
    };
    let touchY = null;
    const onTouchStart = e => { touchY = e.touches[0].clientY; };
    const onTouchMove = e => {
        if (touchY === null) return;
        e.preventDefault();
        const y = e.touches[0].clientY;
        push((touchY - y) * 1.6);
        touchY = y;
    };
    const keys = { ArrowDown: 80, ArrowUp: -80, PageDown: 400, PageUp: -400, " ": 300, End: 9999, Home: -9999 };
    const onKey = e => {
        if (!(e.key in keys)) return;
        e.preventDefault();
        push(keys[e.key]);
    };

    addEventListener("wheel", onWheel, { passive: false });
    addEventListener("touchstart", onTouchStart, { passive: true });
    addEventListener("touchmove", onTouchMove, { passive: false });
    addEventListener("keydown", onKey);
    // a click just opens it the rest of the way
    layer.addEventListener("pointerdown", () => { target = 1; });

    function finish() {
        if (done) return;
        done = true;
        removeEventListener("wheel", onWheel);
        removeEventListener("touchstart", onTouchStart);
        removeEventListener("touchmove", onTouchMove);
        removeEventListener("keydown", onKey);
        html.classList.remove("revealing");
        layer.classList.add("out");
        setTimeout(() => layer.remove(), 500);
    }

    // ---------- the aperture ----------

    function draw() {
        ctx.clearRect(0, 0, W, H);
        const cx = W / 2, cy = H / 2;
        const maxR = Math.hypot(W, H) / 2 + 40;
        const o = ease(open);
        const r = 10 + o * maxR;
        const spin = o * 1.1;

        ctx.fillStyle = "#0b0b0b";
        ctx.fillRect(0, 0, W, H);

        // cut the hexagon hole out of the black
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
        ctx.strokeStyle = "rgba(255,255,255,.16)";
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

        // name and an f-stop readout that follows how open it is, fades out as it opens
        const fade = 1 - clamp(open * 2.4);
        if (fade > 0) {
            ctx.globalAlpha = fade;
            ctx.textAlign = "center";
            ctx.fillStyle = "#f3efe7";
            ctx.font = `600 ${Math.min(44, W / 12)}px ${css("--heading-font") || "sans-serif"}`;
            ctx.fillText("Omar El Sadek", cx, cy - 46);
            const stops = ["f/22", "f/16", "f/11", "f/8", "f/5.6", "f/4", "f/2.8", "f/1.8"];
            ctx.font = `13px ${css("--label-font") || "monospace"}`;
            ctx.fillStyle = accent;
            ctx.fillText(`${stops[Math.min(stops.length - 1, Math.floor(open * 3 * stops.length))]}   1/250   ISO 400`, cx, cy + 64);
            ctx.globalAlpha = 1;
        }
        hint.style.opacity = fade;
    }

    function loop() {
        if (done) return;
        open += (target - open) * 0.14;
        if (Math.abs(target - open) < 0.0005) open = target;
        draw();
        if (open >= 0.999) return finish();
        requestAnimationFrame(loop);
    }
    loop();
})();
