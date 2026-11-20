// ==========================================================
// easter egg: the little camera in the footer
// press it, the screen flashes and a polaroid slides out and develops.
// you can drag them around, double click one to toss it. max 4 on screen
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

    // shuffle a fresh deck so you don't get the same photo twice in a row
    function nextShot() {
        if (!deck.length) deck = [...SHOTS].sort(() => Math.random() - 0.5);
        return `images/gallery/${deck.pop()}.jpg`;
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
        card.addEventListener("dblclick", () => {
            card.classList.add("gone");
            setTimeout(() => card.remove(), 350);
        });
    }

    // ---------- take a picture ----------

    function snap() {
        flash();
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
        card.innerHTML = `<img src="${nextShot()}" alt="" draggable="false"><figcaption>no. ${String(shots).padStart(2, "0")}</figcaption>`;
        document.body.append(card);
        makeDraggable(card);
    }

    if (cam) cam.addEventListener("click", snap);
}
