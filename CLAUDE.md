# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Static marketing website for Cavalucci Construction, served at **cavalucci.com** via GitHub Pages (custom domain set by the `CNAME` file). There is **no build step, no framework, and no JavaScript bundler** — files are served exactly as they sit in the repo. The lone npm dependency (`bootstrap` in `package.json`) is unused at runtime; Bootstrap is loaded from a CDN in each page's `<head>`.

To preview locally, open the HTML files directly or serve the root with any static server (e.g. `npx serve .` or VS Code Live Server). There are no tests or lint configured.

## Layout

- `index.html` — home page, lives at repo root (so its asset paths are `images/...`, `styles/...`).
- `pages/` — every other page (`about`, `services`, `testimonial`, `contact`, `tos`, `privacy`). These are one level deep, so their asset paths are `../images/...`, `../styles/...`. **Mind the relative-path prefix when moving links/assets between root and `pages/`.**
- `styles/` — one CSS file per page (`index.css`, `about.css`, …) plus `global.css`. Each page's stylesheet starts with `@import url(global.css);`. The `tos.html` and `privacy.html` pages link `global.css` directly instead.
- `images/` — site assets; `images/gallery/compressed-imgs/` holds the optimized gallery images actually referenced by the site.
- `public/css/`, `resources/`, `Untitled-1.txt` — leftover/scratch files not wired into the live pages; ignore unless asked.

## Conventions that span multiple files

These are duplicated by hand across every page — when you change one, change them everywhere:

- **Nav bar and footer** are hand-copied into each HTML file (no templating/includes). Updating a nav link or footer entry means editing every page. The footer's `©<year>` is filled by an inline `<script>` setting `#current-year` to the current year.
- **Google Analytics** (`gtag.js`, measurement ID `G-ZJY6G410FW`) is pasted into the `<head>` of every page. New pages must include the same snippet.
- **SEO/Open Graph meta** — each page has its own `<title>`, `description`, `keywords`, and `og:*` tags. Keep them per-page and accurate when adding pages.
- The active nav item uses `class="nav-link active"`; set this to the current page on each page.

## Design system (`styles/global.css`)

All brand tokens live in `:root`: accent `--accent: #550000` (deep maroon, used for focus rings via `--bs-focus-ring-color: rgba(85,0,0,.25)`), `--dark`, `--light`, `--d-blue`, plus fonts (`Libre Franklin` headings, `Inter` body, loaded from Google Fonts in `global.css`). Headings are uppercase/900-weight globally. Custom button classes: `.red`, `.white`, `.transparent-red`, `.transparent-white` (and `-sm` variants). Prefer these tokens/classes over hardcoded values so styling stays consistent.

## Contact form

`pages/contact.html` posts to **FormSubmit.co** (`action="https://formsubmit.co/ralph@cavalucci.com"`). It relies on hidden fields: `_honey` (honeypot — keep it hidden), `_subject`, `_template=table`, and `_next` (post-submit redirect). No server code is involved.

## Branches & deployment

Branches: `development` → `main` → `production`. Work happens on `development`; changes flow up via PRs (see recent merge history). GitHub Pages publishes the site, and `CNAME` (`cavalucci.com`) must remain in the deployed branch or the custom domain breaks.
