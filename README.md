# QR Code Generator

A polished, fully client-side QR code generator. Plain HTML/CSS/JS — no build step, no backend, no API keys.

## Features
- Live QR generation as you type (debounced)
- Foreground / background color pickers
- Size presets (small / medium / large)
- Error correction levels (L / M / Q / H)
- Optional centered logo upload (auto-boosts to High error correction)
- Download as PNG (high-res export) or SVG (vector, scalable)
- Fully responsive, modern SaaS-style UI

## Tech
- Vanilla HTML, CSS, JavaScript
- [`qrcode-generator`](https://github.com/kazuhikoarase/qrcode-generator) loaded via CDN for QR matrix data — the app then draws the canvas/SVG output itself, which is what makes custom colors, sizing, and logo embedding possible.

## Run locally
Just open `index.html` in a browser, or serve the folder with any static server:

```bash
npx serve .
```

## Deploy to Vercel
1. Push this folder to a GitHub repo.
2. Import the repo in Vercel.
3. Framework preset: **Other** (or leave as detected static site).
4. No build command, no output directory override needed — deploy as-is.

## Files
- `index.html` — markup
- `style.css` — styling
- `script.js` — QR generation, customization, and export logic
