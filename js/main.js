// main.js - all the interaction for the portfolio
// theme studio, case study drawer, before/after sliders,
// filters, lightbox, live clock, magnetic buttons and the scroll fade-ins
// no libraries, just plain javascript

// get references to the elements we will use (some only exist on the homepage)
const root = document.documentElement;
const body = document.body;
const EMAIL = "ompel-sadek@myseneca.ca";

// pages inside /projects/ need "../" in front of paths
const BASE = location.pathname.includes("/projects/") ? "../" : "";

// small helpers so I don't repeat myself
const $ = (sel, scope = document) => scope.querySelector(sel);
const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));

function store(key, value) {
    // localStorage can throw in private mode, so wrap it
    try {
        if (value === undefined) return JSON.parse(localStorage.getItem(key));
        localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
        return null;
    }
}


// ---------- toast ----------

const toast = document.createElement("div");
toast.className = "toast";
toast.setAttribute("role", "status");
body.appendChild(toast);
let toastTimer;

function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}


// ---------- clipboard ----------

// the modern way first, then the old textarea trick if the browser blocks it
async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
        ta.remove();
        return ok;
    }
}

async function copyEmail() {
    const ok = await copyText(EMAIL);
    showToast(ok ? "Email copied: " + EMAIL : "Couldn't copy, it's " + EMAIL);
    return ok;
}


// ---------- theme engine ----------

// the studio only sets these four, everything else in the css is mixed from them
const TOKEN_KEYS = ["--bg-canvas", "--bg-surface", "--text-primary", "--accent"];

const PRESETS = [
    { name: "Omar Paper", tokens: ["#f6f4ef", "#ffffff", "#151515", "#e8262d"] },
    { name: "Omar Ink", tokens: ["#111111", "#1a1a1a", "#eeebe5", "#e8262d"] },
    { name: "Obsidian & Acid", tokens: ["#0b0d10", "#14181f", "#f3f4f6", "#ccff00"] },
    { name: "Swiss Editorial", tokens: ["#f7f6f2", "#ffffff", "#111111", "#ff3b00"] },
    { name: "Midnight Cobalt", tokens: ["#090e1a", "#11192e", "#f8fafc", "#38bdf8"] },
    { name: "Monochrome Gallery", tokens: ["#ffffff", "#f4f4f5", "#09090b", "#18181b"] },
    { name: "Warm Terracotta", tokens: ["#f5efea", "#fdfbf9", "#231f20", "#c85a32"] }
];

// relative luminance from the WCAG formula
function luminance(hex) {
    const rgb = hex.replace("#", "").match(/.{2}/g).map(h => parseInt(h, 16) / 255);
    const lin = rgb.map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrastRatio(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

// pick black or white text for the accent, whichever has more contrast
function accentContrast(accent) {
    return contrastRatio(accent, "#ffffff") >= contrastRatio(accent, "#000000") ? "#ffffff" : "#000000";
}

let currentTokens = PRESETS[0].tokens.slice();
let currentPreset = PRESETS[0].name;

function applyTokens(tokens, presetName) {
    currentTokens = tokens.slice();
    currentPreset = presetName || "Custom";
    TOKEN_KEYS.forEach((key, i) => root.style.setProperty(key, tokens[i]));
    root.style.setProperty("--accent-contrast", accentContrast(tokens[3]));
    // dark mode = the canvas is dark, used for the logo glow and color-scheme
    root.setAttribute("data-mode", luminance(tokens[0]) < 0.2 ? "dark" : "light");
    store("theme", { tokens: currentTokens, preset: currentPreset });
    syncStudio();
}

function presetByName(name) {
    return PRESETS.find(p => p.name === name);
}

function setPreset(name) {
    const p = presetByName(name);
    if (p) applyTokens(p.tokens, p.name);
}

// first load: saved theme, otherwise follow the computer's dark/light setting
// (called further down, once the theme studio panel exists)
function loadTheme() {
    const saved = store("theme");
    if (saved && saved.tokens) {
        applyTokens(saved.tokens, saved.preset);
    } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        setPreset(prefersDark ? "Omar Ink" : "Omar Paper");
    }
}

// header sun/moon just jumps between my two brand presets
const themeBtn = $(".theme-toggle");
if (themeBtn) {
    themeBtn.addEventListener("click", () => {
        setPreset(root.getAttribute("data-mode") === "dark" ? "Omar Paper" : "Omar Ink");
    });
}

function cssTokens() {
    const lines = TOKEN_KEYS.map((k, i) => "    " + k + ": " + currentTokens[i] + ";");
    lines.push("    --accent-contrast: " + accentContrast(currentTokens[3]) + ";");
    return ":root {\n" + lines.join("\n") + "\n}";
}


// ---------- theme studio (floating panel) ----------

const studioFab = document.createElement("button");
studioFab.className = "studio-fab";
studioFab.setAttribute("aria-expanded", "false");
studioFab.setAttribute("aria-controls", "studio");
studioFab.setAttribute("aria-label", "Theme Studio");
studioFab.innerHTML = '<span class="fab-swatch"><i></i><i></i><i></i></span><span class="fab-label">Theme Studio</span>';

const studio = document.createElement("section");
studio.className = "studio";
studio.id = "studio";
studio.setAttribute("aria-label", "Theme Studio");
studio.innerHTML = `
    <h2>Theme Studio</h2>
    <span class="label">Presets</span>
    <div class="presets">
        ${PRESETS.map(p => `
            <button class="preset" data-preset="${p.name}">
                <span class="chips-preview">${p.tokens.map(c => `<i style="--c:${c}"></i>`).join("")}</span>
                ${p.name}
            </button>`).join("")}
    </div>
    <span class="label">Fine-tune</span>
    <div class="pickers">
        <label class="picker"><input type="color" data-token="0"><span>Canvas<code></code></span></label>
        <label class="picker"><input type="color" data-token="1"><span>Surface<code></code></span></label>
        <label class="picker"><input type="color" data-token="2"><span>Text<code></code></span></label>
        <label class="picker"><input type="color" data-token="3"><span>Accent<code></code></span></label>
    </div>
    <p class="contrast-note"></p>
    <div class="studio-actions">
        <button class="btn" data-studio="reset">Reset</button>
        <button class="btn primary" data-studio="copy">Copy CSS tokens</button>
    </div>`;

body.appendChild(studio);
body.appendChild(studioFab);

function toggleStudio(force) {
    const open = typeof force === "boolean" ? force : !studio.classList.contains("open");
    studio.classList.toggle("open", open);
    studioFab.setAttribute("aria-expanded", open);
}

studioFab.addEventListener("click", () => toggleStudio());

studio.addEventListener("click", async e => {
    const preset = e.target.closest("[data-preset]");
    if (preset) setPreset(preset.dataset.preset);

    const action = e.target.closest("[data-studio]");
    if (!action) return;
    if (action.dataset.studio === "reset") {
        setPreset("Omar Paper");
        showToast("Theme reset");
    }
    if (action.dataset.studio === "copy") {
        const ok = await copyText(cssTokens());
        showToast(ok ? "CSS tokens copied" : "Couldn't copy to the clipboard");
    }
});

// "input" fires while dragging the colour wheel, so the page updates live
$$('input[type="color"]', studio).forEach(input => {
    input.addEventListener("input", () => {
        const next = currentTokens.slice();
        next[Number(input.dataset.token)] = input.value;
        applyTokens(next, "Custom");
    });
});

// keep the panel showing whatever is applied right now
function syncStudio() {
    $$('input[type="color"]', studio).forEach(input => {
        const i = Number(input.dataset.token);
        input.value = currentTokens[i];
        input.parentElement.querySelector("code").textContent = currentTokens[i];
    });
    $$(".preset", studio).forEach(btn => btn.classList.toggle("active", btn.dataset.preset === currentPreset));
    const ratio = contrastRatio(currentTokens[2], currentTokens[0]).toFixed(1);
    $(".contrast-note", studio).innerHTML =
        `Text on canvas: ${ratio}:1 ${ratio >= 4.5 ? "&#10003; AA" : "&#9888; below AA"} &middot; Button text auto-set to <b>${accentContrast(currentTokens[3]) === "#ffffff" ? "white" : "black"}</b>`;
}
loadTheme();


// ---------- phone menu ----------

const menuBtn = $(".menu-btn");
const nav = $(".nav");

if (menuBtn && nav) {
    menuBtn.addEventListener("click", () => {
        const isOpen = nav.classList.toggle("open");
        menuBtn.setAttribute("aria-expanded", isOpen);
    });

    // close the menu after picking a link so it doesn't cover the page
    $$("a", nav).forEach(link => link.addEventListener("click", () => {
        nav.classList.remove("open");
        menuBtn.setAttribute("aria-expanded", false);
    }));
}


// ---------- live clock (toronto time) ----------

const clockEl = $(".clock");
if (clockEl) {
    const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Toronto",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZoneName: "short" // gives EST or EDT on its own
    });
    const tick = () => { clockEl.innerHTML = '<span class="city">Toronto </span>' + fmt.format(new Date()); };
    tick();
    setInterval(tick, 1000);
}


// ---------- magnetic buttons ----------

// buttons lean toward the cursor when it's within 40px of their edge, max 6px
const finePointer = window.matchMedia("(pointer: fine)").matches;
const calmMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (finePointer && !calmMotion) {
    const magnets = $$(".magnetic");
    window.addEventListener("pointermove", e => {
        magnets.forEach(btn => {
            const r = btn.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const dx = e.clientX - cx;
            const dy = e.clientY - cy;
            // distance from the button's edge, not its centre
            const outsideX = Math.max(0, Math.abs(dx) - r.width / 2);
            const outsideY = Math.max(0, Math.abs(dy) - r.height / 2);
            if (Math.hypot(outsideX, outsideY) < 40) {
                const mx = Math.max(-6, Math.min(6, dx / (r.width / 2 + 40) * 6));
                const my = Math.max(-6, Math.min(6, dy / (r.height / 2 + 40) * 6));
                btn.style.transform = `translate(${mx}px, ${my}px)`;
            } else {
                btn.style.transform = "";
            }
        });
    });

    // logo tilts a little with the mouse too
    const logo = $(".hero-logo");
    if (logo) {
        window.addEventListener("pointermove", e => {
            const x = e.clientX / window.innerWidth - 0.5;
            const y = e.clientY / window.innerHeight - 0.5;
            logo.style.setProperty("--ry", (x * 16).toFixed(2) + "deg");
            logo.style.setProperty("--rx", (y * -12).toFixed(2) + "deg");
        });
    }
}


// ---------- filters (used by the work grid and the playground) ----------

// hiding with a short fade + shrink, then [hidden] so the grid reflows
function runFilter(items, match) {
    items.forEach(item => {
        if (match(item)) {
            if (item.hidden) {
                item.hidden = false;
                item.classList.add("is-out");
                requestAnimationFrame(() => requestAnimationFrame(() => item.classList.remove("is-out")));
            }
        } else if (!item.hidden) {
            item.classList.add("is-out");
            setTimeout(() => {
                if (item.classList.contains("is-out")) item.hidden = true;
            }, 260);
        }
    });
}

function setupFilters(groupSel, itemSel) {
    const buttons = $$(groupSel + " .filter");
    const items = $$(itemSel);
    if (!buttons.length) return null;

    // put the number of pieces next to each pill
    buttons.forEach(btn => {
        const cat = btn.dataset.filter;
        const count = cat === "all" ? items.length : items.filter(i => i.dataset.cat.split(" ").includes(cat)).length;
        btn.insertAdjacentHTML("beforeend", `<sup>${count}</sup>`);
    });

    function select(cat) {
        buttons.forEach(b => {
            const on = b.dataset.filter === cat;
            b.classList.toggle("active", on);
            b.setAttribute("aria-pressed", on);
        });
        runFilter(items, item => cat === "all" || item.dataset.cat.split(" ").includes(cat));
    }

    buttons.forEach(btn => btn.addEventListener("click", () => select(btn.dataset.filter)));
    return select;
}

const filterWork = setupFilters("#work-filters", ".bento-card");
const filterPlay = setupFilters("#play-filters", ".tile");


// ---------- lightbox ----------

const lightbox = $(".lightbox");
let lbItems = [];
let lbIndex = 0;
let lastFocus = null;

function showLightboxItem() {
    const src = lbItems[lbIndex];
    // videos get controls and autoplay, images just show
    $(".lb-stage").innerHTML = src.endsWith(".mp4")
        ? `<video src="${src}" controls autoplay playsinline></video>`
        : `<img src="${src}" alt="">`;
    $(".lb-count").textContent = lbItems.length > 1 ? `${lbIndex + 1} / ${lbItems.length}` : "";
}

function openLightbox(tile) {
    // data-full can hold more than one file separated by commas
    lbItems = tile.dataset.full.split(",").map(s => s.trim());
    lbIndex = 0;
    $(".lightbox figcaption").innerHTML = `<b>${$("h3", tile).textContent}</b><br>${tile.dataset.desc || ""}`;
    showLightboxItem();
    lastFocus = tile;
    lightbox.classList.add("open");
    body.style.overflow = "hidden";
    $(".lb-close").focus();
}

function closeLightbox() {
    lightbox.classList.remove("open");
    $(".lb-stage").innerHTML = ""; // removing the video stops it playing
    body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
}

function stepLightbox(dir) {
    if (lbItems.length < 2) return;
    lbIndex = (lbIndex + dir + lbItems.length) % lbItems.length;
    showLightboxItem();
}

if (lightbox) {
    $$(".tile[data-full]").forEach(tile => tile.addEventListener("click", () => openLightbox(tile)));
    $(".lb-close").addEventListener("click", closeLightbox);
    $(".lb-prev").addEventListener("click", () => stepLightbox(-1));
    $(".lb-next").addEventListener("click", () => stepLightbox(1));
    lightbox.addEventListener("click", e => { if (e.target === lightbox) closeLightbox(); });
}


// ---------- before / after sliders ----------

function initCompare(scope = document) {
    $$(".compare:not([data-ready])", scope).forEach(box => {
        box.dataset.ready = "1";
        const handle = $(".compare-handle", box);
        let dragging = false;

        function setPos(pct) {
            pct = Math.max(0, Math.min(100, pct));
            box.style.setProperty("--pos", pct + "%");
            handle.setAttribute("aria-valuenow", Math.round(pct));
        }

        function fromEvent(e) {
            const r = box.getBoundingClientRect();
            setPos((e.clientX - r.left) / r.width * 100);
        }

        // pointer events cover mouse, pen and touch in one go
        box.addEventListener("pointerdown", e => {
            dragging = true;
            box.setPointerCapture(e.pointerId);
            fromEvent(e);
        });
        box.addEventListener("pointermove", e => { if (dragging) fromEvent(e); });
        box.addEventListener("pointerup", () => { dragging = false; });
        box.addEventListener("pointercancel", () => { dragging = false; });

        // keyboard: arrows nudge it, home/end jump to the sides
        handle.addEventListener("keydown", e => {
            const now = Number(handle.getAttribute("aria-valuenow"));
            if (e.key === "ArrowLeft") setPos(now - 5);
            if (e.key === "ArrowRight") setPos(now + 5);
            if (e.key === "Home") setPos(0);
            if (e.key === "End") setPos(100);
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) e.preventDefault();
        });

        // keep the two videos in sync so the split lines up
        const vids = $$("video", box);
        if (vids.length === 2) {
            const [after, before] = vids;
            after.addEventListener("timeupdate", () => {
                if (Math.abs(before.currentTime - after.currentTime) > 0.12) before.currentTime = after.currentTime;
            });
            after.addEventListener("play", () => before.play().catch(() => {}));
            after.addEventListener("pause", () => before.pause());
        }
    });
}
initCompare();


// ---------- case study drawer ----------

// clicking a project opens it in a slide-over panel without leaving the page.
// the full page still exists, so links can be shared and it works without js
const drawer = document.createElement("div");
drawer.className = "drawer";
drawer.setAttribute("aria-hidden", "true");
drawer.innerHTML = `
    <div class="drawer-scrim" data-close></div>
    <aside class="drawer-panel" role="dialog" aria-modal="true" aria-label="Case study">
        <div class="drawer-bar">
            <span class="label"><a class="drawer-full" href="#">Open full page &#8599;</a></span>
            <button class="icon-btn" data-close aria-label="Close case study">
                <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
        </div>
        <div class="drawer-body"></div>
    </aside>`;
body.appendChild(drawer);

const drawerBody = $(".drawer-body", drawer);
let drawerReturn = null;

async function openDrawer(url, trigger) {
    drawerReturn = trigger || drawerReturn;
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    body.style.overflow = "hidden";
    $(".drawer-full", drawer).href = url;
    drawerBody.innerHTML = '<p class="label drawer-loading">Loading&hellip;</p>';
    drawerBody.scrollTop = 0;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.status);
        const doc = new DOMParser().parseFromString(await res.text(), "text/html");
        const content = $(".case-content", doc);
        $$(".back", content).forEach(el => el.remove());

        // the page's paths are relative to /projects/, so make them absolute
        const pageUrl = new URL(url, location.href);
        $$("[src], [poster], [href]", content).forEach(el => {
            ["src", "poster", "href"].forEach(attr => {
                const v = el.getAttribute(attr);
                if (v && !v.startsWith("#") && !v.startsWith("mailto:")) el.setAttribute(attr, new URL(v, pageUrl).href);
            });
        });

        drawerBody.innerHTML = "";
        drawerBody.appendChild(content);
        initCompare(drawerBody);
        $(".drawer-panel [data-close]", drawer).focus();
    } catch (err) {
        // file:// or a network problem - just go to the page instead
        location.href = url;
    }
}

function closeDrawer() {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    body.style.overflow = "";
    // stop any videos playing in the drawer
    setTimeout(() => { if (!drawer.classList.contains("open")) drawerBody.innerHTML = ""; }, 500);
    if (drawerReturn) drawerReturn.focus();
}

drawer.addEventListener("click", e => {
    if (e.target.closest("[data-close]")) return closeDrawer();
    // "next project" links inside the drawer open in the drawer too
    const link = e.target.closest(".next-project");
    if (link) {
        e.preventDefault();
        openDrawer(link.href);
    }
});

$$("[data-case]").forEach(card => {
    card.addEventListener("click", e => {
        // ctrl/cmd click still opens the real page in a new tab
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        openDrawer(card.getAttribute("href"), card);
    });
});


// ---------- keyboard shortcuts ----------

document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
        // close whatever is on top first
        if (lightbox && lightbox.classList.contains("open")) return closeLightbox();
        if (drawer.classList.contains("open")) return closeDrawer();
        if (studio.classList.contains("open")) return toggleStudio(false);
    }

    if (lightbox && lightbox.classList.contains("open")) {
        if (e.key === "ArrowRight") stepLightbox(1);
        if (e.key === "ArrowLeft") stepLightbox(-1);
    }
});


// ---------- copy email buttons ----------

$$(".copy-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
        const ok = await copyEmail();
        if (!ok) return;
        btn.classList.add("done");
        $(".copy-label", btn).textContent = "Copied";
        setTimeout(() => {
            btn.classList.remove("done");
            $(".copy-label", btn).textContent = "Copy email";
        }, 2200);
    });
});


// ---------- scroll reveal ----------

// IntersectionObserver tells us when something scrolls into view
const revealEls = $$(".reveal");

if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("in");
                observer.unobserve(entry.target); // only animate once
            }
        });
    }, { threshold: 0.12 });
    revealEls.forEach(el => observer.observe(el));
} else {
    revealEls.forEach(el => el.classList.add("in"));
}


// ---------- footer year ----------

$$(".year").forEach(el => { el.textContent = new Date().getFullYear(); });
