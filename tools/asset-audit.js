#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const assetsDir = path.join(rootDir, "assets");

const exists = (p) => {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
};

const statSafe = (p) => {
  try {
    return fs.statSync(p);
  } catch {
    return null;
  }
};

const toPosixRel = (absPath) =>
  path.relative(rootDir, absPath).split(path.sep).join("/");

const walkFiles = (dir) => {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
      continue;
    }
    if (entry.isFile()) out.push(full);
  }
  return out;
};

const formatBytes = (bytes) => {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  const kb = bytes / 1024;
  if (kb >= 1) return `${kb.toFixed(1)} KB`;
  return `${bytes} B`;
};

const extGroup = (ext) => {
  const e = ext.toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".ico"].includes(e)) return "images";
  if ([".mp4", ".webm", ".mov", ".m4v", ".mkv"].includes(e)) return "videos";
  if ([".css"].includes(e)) return "css";
  if ([".js", ".mjs"].includes(e)) return "js";
  if ([".woff", ".woff2", ".ttf", ".otf", ".eot"].includes(e)) return "fonts";
  return "other";
};

if (!exists(assetsDir)) {
  console.error(`No assets directory found at: ${assetsDir}`);
  process.exit(1);
}

const files = walkFiles(assetsDir);
/** @type {{path: string, bytes: number, group: string}[]} */
const items = [];

for (const abs of files) {
  const st = statSafe(abs);
  if (!st || !st.isFile()) continue;
  items.push({
    path: toPosixRel(abs),
    bytes: st.size,
    group: extGroup(path.extname(abs))
  });
}

items.sort((a, b) => b.bytes - a.bytes);

const totals = new Map();
let grandTotal = 0;
for (const it of items) {
  grandTotal += it.bytes;
  totals.set(it.group, (totals.get(it.group) || 0) + it.bytes);
}

const topN = Number(process.env.TOP) || 25;

console.log(`Assets scanned: ${items.length} files`);
console.log(`Total size: ${formatBytes(grandTotal)}`);
console.log("\nTotals by type:");
for (const [k, v] of Array.from(totals.entries()).sort((a, b) => b[1] - a[1])) {
  console.log(`- ${k}: ${formatBytes(v)}`);
}

console.log(`\nTop ${Math.min(topN, items.length)} largest files:`);
for (const it of items.slice(0, topN)) {
  console.log(`- ${formatBytes(it.bytes).padStart(10)}  ${it.path}`);
}

console.log("\nNotes:");
console.log("- Hosting already sets long-lived cache headers for /assets/** (immutable).");
console.log("- Prioritize compressing the biggest videos/images first for the fastest wins.");
