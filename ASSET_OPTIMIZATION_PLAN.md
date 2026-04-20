# Asset optimization plan (no UI changes)

This repo already applies long-lived caching for `/assets/**` via `Cache-Control: public,max-age=31536000,immutable` (see `firebase.json`). The best performance wins come from reducing bytes of the largest assets without changing layout/styling.

## 1) Measure

- Run: `node tools/asset-audit.js`
- Focus first on the top 10–25 largest assets.

## 2) Images

- Convert heavy `.png/.jpg` to `.webp` (or `.avif` where supported) while keeping the same display dimensions.
- Prefer:
  - Logos/icons: `.svg` or optimized `.png`
  - Photos/hero images: `.webp`/`.avif`
- Keep filenames stable and version with the existing `?v=` query params (already used across pages).

## 3) Video

- Re-encode large `.mp4` assets using modern settings (H.264 baseline/high, sensible bitrate).
- If video is only used as background/preview, consider shorter clips and lower bitrate.
- Consider hosting very large videos on a dedicated video CDN (still referenced from the site) if bandwidth becomes a concern.

## 4) CSS/JS

- Keep `/assets/**` caching immutable (already done).
- If JS grows, consider splitting by page and loading only what’s needed (no redesign required).

## 5) Verification

- Re-run `node tools/asset-audit.js` after changes.
- Validate headers locally with the dev server (`PORT=8081 node dev-server.js`) and `curl.exe -I`.
