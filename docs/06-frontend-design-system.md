# Frontend Design System

The interface follows the Greecon brand Design System (October 2026) — the actual brand guide
Greecon supplied, not a placeholder. It must feel calm, precise, stable, minimal, and built for the
long term: plain language, no hype, no color-only status, no decoration without a reason.

This file documents what is actually implemented in `apps/web/src/app/globals.css` and
`apps/web/src/app/layout.tsx`. Any future brand update should land here first, then in those files.

## Typography

One typeface: **IBM Plex Serif**, weights 400/500/600/700 plus italic. Loaded via
`next/font/google` in `layout.tsx` (not a runtime `<link>` to Google Fonts) so the files are
self-hosted at build time — no external request at runtime, no layout shift, and it works inside
the static GitHub Pages export too. Exposed as the CSS variable `--font-plex-serif`, referenced
from `globals.css`'s `font-family`.

Headings are Title Case; body text, buttons, and labels are sentence case. "greecon.earth" is
always lowercase, in running text and in links.

## Colors

Exact tokens from the brand palette, defined in `globals.css`'s `:root`:

| Token | Hex | Role |
|---|---|---|
| `--cream` | `#f7f1e9` | Page background |
| `--sand` | `#e8e0d3` | Sidebar / surface |
| `--forest` | `#2f3d35` | Primary text ink on light grounds |
| `--mist` | `#d8e2dc` | Secondary surface (site map, login page background) |
| `--leaf` | `#448561` | Decorative accent, focus rings, the brand mark itself |
| `--night` | `#1a211d` | Primary text color (near-black, not pure black) |
| `--action` | `#2f6b4a` | Primary button / accent-strong fill — **not** the same as forest |
| `--on-action` | `#f7f1e9` | Text/icon color on top of `--action` |

`--action` is deliberately a separate, lighter, more saturated green than `--forest` — every
primary button and filled accent in the app uses `--accent-strong`, which resolves to `--action`.
Using `--forest` there instead (an earlier bug) rendered every button near-black, darker than the
brand actually specifies.

Status is never color-alone: every `.status-*` pill pairs a tinted background with a word
("OK", "Watch", "Warning", "Critical", "Offline", "Simulated", "Manual Override") and a dot — no
raw red/amber/green exists anywhere in the brand for status; the four status hues
(`--critical-fg`/`--warning-fg`/`--watch-fg`/`--ok-fg`) are muted, desaturated tones chosen to pair
with text, not to be read as traffic lights on their own.

## Spacing and Radius

Straight from the spec:

- Spacing scale: `--space-1` (4px) through `--space-24` (96px), in the sequence 1/2/3/4/6/8/12/16/24.
- Radius scale: `--radius-sm` (6px, form fields), `--radius-md` (12px, cards/panels), `--radius-lg`
  (24px, large feature cards), `--radius-pill` (999px, buttons/tags/status swatches).

Pills for buttons, tags, and status swatches; the larger radii for cards; the small radius stays on
form controls. Don't invent a one-off radius outside this scale.

## Motion

Fades and small position shifts only, 150–250ms ease-out. No springs, no bounce, no page-transition
choreography.

## Icons

The real Greecon Icon Library: 56 icons on a 24×24 grid (22×22 live area), 1.5px stroke, round
caps/joins, never filled. The app's sidebar nav (`apps/web/src/components/Nav.tsx`) uses the
Platform category of that set (dashboard, multi-site, sensor, automation-flow, alerts, safety,
analytics, edge-device, report, audit-log, network-hub, cloud, secure-access), reproduced inline
with `stroke="currentColor"` so nav hover/active states still recolor them. Leaf (`--leaf`) is
decorative-only on cream or night grounds — never used as an icon stroke on forest, and never as a
status indicator.

## UI Rules

- Flat over boxed: subtle 1px borders and hover-triggered elevation, not heavy tinted card backgrounds.
- Generous whitespace and hover affordances (row highlight, active-nav state) over dense chrome.
- Keep cards to operational data, repeated items, and dialogs.
- Avoid neon colors, startup gradients, flashy motion, glassmorphism, excessive shadows, and hype copy.
- No exclamation marks, no emoji, no filler stats, no pre-revenue claim stated as settled fact.
- Prefer direct operational language: `System stable`, `Sensor quality degraded`, `Rule simulated`, `Action blocked by safety policy`.

## Assets

`apps/web/public/greecon-logo.svg` is the real Greecon mark, in the brand's `--leaf` green.

Do not put confidential GAIA Tech identity or internals into public UI unless explicitly approved for internal-only deployments.
