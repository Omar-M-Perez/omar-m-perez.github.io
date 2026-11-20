// ==========================================================
// easter egg: the little camera in the footer
// press it, the screen flashes and a polaroid slides out and develops.
// you can drag them around, close one with its x (or double click it). max 4 on screen.
// the first press asks first, because the flash is a bright white screen
// ==========================================================

{
    const cam = document.querySelector(".egg-cam");

    // only shots that are already on the main page
    const SHOTS = [
        "gt3-1", "gt3-4", "gt3-6", "gt3d-2", "gt3d-5", "cars-1", "cars-3",
        "cars-5", "city-1", "city-2", "detail-2", "detail-5", "is-1", "md-2"
    ];
    const MAX = 4;
    let deck = [];
    let shots = 0;
    let useFlash = null; // null until they pick, then true or false for the rest of the visit
    try {
        const saved = sessionStorage.getItem("egg-flash");
        if (saved) useFlash = saved === "on";
    } catch (e) {}

    // shuffle a fresh deck, and skip anything already on screen so there are never two of the same
    function nextShot() {
        const showing = [...document.querySelectorAll(".polaroid:not(.gone) img")].map(i => i.getAttribute("src"));
        for (let tries = 0; tries < SHOTS.length * 2; tries++) {
            if (!deck.length) deck = [...SHOTS].sort(() => Math.random() - 0.5);
            const src = `images/gallery/${deck.pop()}.jpg`;
            if (!showing.includes(src)) return src;
        }
        return `images/gallery/${SHOTS[0]}.jpg`;
    }

    // ---------- flash warning ----------

    function ask() {
        if (document.querySelector(".egg-warn")) return;
        const r = cam.getBoundingClientRect();
        const box = document.createElement("div");
        box.className = "egg-warn";
        box.setAttribute("role", "dialog");
        box.setAttribute("aria-label", "Flash warning");
        box.innerHTML = `<span class="label">Heads up</span><p>This takes a photo with a bright white screen flash.</p><div><button data-flash="on">With flash</button><button data-flash="off">No flash</button></div>`;
        box.style.left = Math.min(innerWidth - 250, Math.max(10, r.left + r.width / 2 - 120)) + "px";
        box.style.top = Math.max(10, r.top - 150) + "px";
        document.body.append(box);
        box.querySelector("button").focus();
        box.addEventListener("click", e => {
            const b = e.target.closest("button");
            if (!b) return;
            useFlash = b.dataset.flash === "on";
            try { sessionStorage.setItem("egg-flash", b.dataset.flash); } catch (err) {}
            box.remove();
            snap();
        });
        // clicking anywhere else or escape just closes it
        setTimeout(() => {
            const close = e => {
                if (e.type === "keydown" && e.key !== "Escape") return;
                if (e.type === "pointerdown" && box.contains(e.target)) return;
                box.remove();
                removeEventListener("pointerdown", close);
                removeEventListener("keydown", close);
            };
            addEventListener("pointerdown", close);
            addEventListener("keydown", close);
        });
    }

    function flash() {
        const f = document.createElement("div");
        f.className = "egg-flash";
        document.body.append(f);
        f.addEventListener("animationend", () => f.remove());
    }

    // ---------- dragging ----------

    function makeDraggable(card) {
        let sx = 0, sy = 0, ox = 0, oy = 0;
        card.addEventListener("pointerdown", e => {
            if (e.target.closest(".polaroid-close")) return; // let the x do its thing
            card.setPointerCapture(e.pointerId);
            sx = e.clientX; sy = e.clientY;
            ox = parseFloat(card.style.left); oy = parseFloat(card.style.top);
            card.classList.add("held");
            card.style.zIndex = 400 + (++shots);
        });
        card.addEventListener("pointermove", e => {
            if (!card.classList.contains("held")) return;
            card.style.left = ox + e.clientX - sx + "px";
            card.style.top = oy + e.clientY - sy + "px";
        });
        const drop = () => card.classList.remove("held");
        card.addEventListener("pointerup", drop);
        card.addEventListener("pointercancel", drop);
        card.addEventListener("dblclick", () => toss(card));
        card.querySelector(".polaroid-close").addEventListener("click", () => toss(card));
    }

    function toss(card) {
        card.classList.add("gone");
        setTimeout(() => card.remove(), 350);
    }

    // ---------- take a picture ----------

    function snap() {
        if (useFlash) flash();
        cam.classList.remove("click");
        void cam.offsetWidth; // restart the little press animation
        cam.classList.add("click");

        const old = document.querySelectorAll(".polaroid:not(.gone)");
        if (old.length >= MAX) old[0].remove();

        // it lands just above the camera, a bit off to one side, slightly crooked
        const r = cam.getBoundingClientRect();
        const card = document.createElement("figure");
        card.className = "polaroid";
        const x = Math.min(innerWidth - 190, Math.max(10, r.left - 80 + (Math.random() * 120 - 60)));
        const y = Math.max(10, r.top - 250 + (Math.random() * 40 - 20));
        card.style.left = x + "px";
        card.style.top = y + "px";
        card.style.setProperty("--tilt", (Math.random() * 14 - 7).toFixed(1) + "deg");
        card.style.zIndex = 400 + (++shots);
        card.innerHTML = `<img src="${nextShot()}" alt="" draggable="false"><figcaption>no. ${String(shots).padStart(2, "0")}</figcaption><button class="polaroid-close" aria-label="Close photo">&times;</button>`;
        document.body.append(card);
        makeDraggable(card);
    }

    if (cam) cam.addEventListener("click", () => (useFlash === null ? ask() : snap()));
}
