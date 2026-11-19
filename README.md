# Omar El Sadek - Portfolio

My design portfolio. Hand-coded in plain HTML, CSS and JavaScript (no frameworks) so I know how every part of it works.

**Live:** https://omar-m-perez.github.io

## What's in it

- **Home** - hero, two crossed tapes with the disciplines (a film strip of links + a print proof, speed follows your scroll), 6 key case studies, then Photography, Film & motion and Print sections, about, experience timeline + skills and contact
- **More work** (`more.html`) - class projects, concept work, UX studies, 3D and sound, filterable. HODDLE's full case study lives here too
- **6 case studies** in `projects/` - Five Senses of Toronto, NIL, Otuka, Compositing (before/after), ARIA, Boncafé (plus HODDLE Studios from the More work page)

## The interactive bits

- **Theme Studio** - floating button bottom right. 7 presets (my two + 5 curated), live colour pickers for canvas / surface / text / accent, auto black-or-white button text from WCAG luminance, saves to localStorage, Reset, Copy CSS tokens
- **Case study drawer** - clicking a project slides it in over the page (it fetches the real page in `projects/`, so every case study still has its own shareable URL)
- **Before / after sliders** - drag (mouse or touch) or use the arrow keys. The two videos stay synced
- **Live status bar** - Toronto clock with EST/EDT and an availability dot
- **Magnetic buttons** - main buttons lean toward the cursor within 40px, max 6px
- **Filters** - the work grid and the More work page fade/shrink out instead of just disappearing
- **3D card stack** - click any photo series, film clip or print piece. Frames fan out in 3D, drag / scroll / arrow keys / dots to flip, click a side card to pull it forward
- **Full film player** - the whole NIL short film plays right on the homepage

### Motion layer (`js/motion.js`)

No libraries. One shared `requestAnimationFrame` loop that sleeps when nothing is moving, a small spring solver (`stiffness` / `damping`), and only transform / opacity changes so it stays on the gpu.

- **Hero morph** - Photo / Film / Print switch. ~480 dots each on their own spring become a camera viewfinder with a focus box that chases the cursor and locks on, a film strip that scatters from the cursor (loose) or a rotating wireframe page with its grid (stiff, rigid). Cycles on its own until you pick one, pauses when off screen
- **Card to case study morph** - the card's image and title spring out and land on the real case study title and cover in the drawer, then hand over
- **Liquid photos** - one shared WebGL canvas redraws the hovered photo with a ripple and an RGB split that follow how fast the cursor moves
- **Lens cursor** - dot + spring ring that stretches with speed, wraps around buttons and opens into a playing clip over film work. Mouse / trackpad only
- Everything turns off with reduced motion, and the touch-only bits are skipped on phones

## Colour tokens

Every colour comes from `:root` in `css/style.css`. Only four are set by hand (`--bg-canvas`, `--bg-surface`, `--text-primary`, `--accent`), the rest (`--bg-elevated`, `--border-hairline`, `--text-secondary`, ...) are mixed from them with `color-mix()`, so any preset or custom colour stays consistent.

## Folder setup

```
index.html          homepage
more.html           everything that isn't a key piece
projects/           one page per case study
css/style.css       all the styles (mobile first, media queries at the bottom)
js/main.js          theme studio, drawer, sliders, filters, lightbox, clock, magnetic buttons
images/             project images, sorted by project
media/              web versions of my videos and sound pieces
assets/             resume pdf
```

## Run it

```
npm i
npm start
```

then open http://localhost:3000

## Adding a new gallery piece

Copy one of the `<button class="tile">` blocks in `index.html` (photography, film or print section) or `more.html` and change:

- `data-cat` - which tab it shows under on `more.html` (`branding`, `ux`, `3d`)
- `data-full` - the image or video files to open, separated by commas
- the thumbnail `src`, the `<h3>` title and the `<p>` description

The tab counts update by themselves.

## Credits

- Group projects credit the whole team on their pages (ARIA, HODDLE Studios, Boncafé, NIL, Eduvia)
- SolSip key visuals are partly AI-generated
- Ford Bronco, Otuka and the PSA are student concepts and are not affiliated with those brands
- Golden statue scene uses Sketchfab assets
- Fonts: Poppins, Inter and JetBrains Mono from Google Fonts
