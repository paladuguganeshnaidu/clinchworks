#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const rootDir = path.resolve(__dirname, "..");

const shouldIgnoreDir = (dirName) =>
  dirName === "node_modules" ||
  dirName === ".git" ||
  dirName === "functions";

const listHtmlFiles = (dir) => {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldIgnoreDir(entry.name)) continue;
      out.push(...listHtmlFiles(full));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
};

const normalizeForCspHash = (scriptText) => {
  // Browsers normalize CRLF/CR to LF in HTML parsing for text nodes.
  return scriptText.replace(/\r\n?/g, "\n");
};

const sha256Base64 = (text) => {
  const buf = Buffer.from(text, "utf8");
  return crypto.createHash("sha256").update(buf).digest("base64");
};

const extractInlineScripts = (html) => {
  /** @type {{openTag: string, content: string, start: number, end: number}[]} */
  const scripts = [];

  const lower = html.toLowerCase();
  let i = 0;
  while (true) {
    const open = lower.indexOf("<script", i);
    if (open === -1) break;

    const tagEnd = lower.indexOf(">", open);
    if (tagEnd === -1) break;

    const openTag = html.slice(open, tagEnd + 1);

    // Skip external scripts.
    if (/\ssrc\s*=\s*/i.test(openTag)) {
      i = tagEnd + 1;
      continue;
    }

    const close = lower.indexOf("</script>", tagEnd + 1);
    if (close === -1) break;

    const content = html.slice(tagEnd + 1, close);
    scripts.push({ openTag, content, start: tagEnd + 1, end: close });

    i = close + "</script>".length;
  }

  return scripts;
};

const toPosixRel = (absPath) =>
  path.relative(rootDir, absPath).split(path.sep).join("/");

const htmlFiles = listHtmlFiles(rootDir);

/** @type {{file: string, hashes: string[], blocks: number}[]} */
const perFile = [];
/** @type {Set<string>} */
const allHashes = new Set();

for (const filePath of htmlFiles) {
  const html = fs.readFileSync(filePath, "utf8");
  const blocks = extractInlineScripts(html);
  if (blocks.length === 0) continue;

  const hashes = [];
  for (const b of blocks) {
    const normalized = normalizeForCspHash(b.content);
    const hash = `sha256-${sha256Base64(normalized)}`;
    hashes.push(hash);
    allHashes.add(hash);
  }

  perFile.push({ file: toPosixRel(filePath), hashes, blocks: blocks.length });
}

perFile.sort((a, b) => a.file.localeCompare(b.file));

const sortedHashes = Array.from(allHashes).sort();

const result = {
  generatedAt: new Date().toISOString(),
  htmlFilesScanned: htmlFiles.map(toPosixRel).sort(),
  inlineScriptHashCount: sortedHashes.length,
  inlineScriptHashes: sortedHashes,
  perFile
};

const outPath = path.join(rootDir, "tools", "csp-script-hashes.json");
fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n", "utf8");

console.log(`Scanned ${htmlFiles.length} HTML files`);
console.log(`Found ${sortedHashes.length} unique inline script hashes`);
console.log(`Wrote ${toPosixRel(outPath)}`);
console.log("\nAdd these to your CSP script-src (remove 'unsafe-inline'):\n");
console.log(sortedHashes.map((h) => `'${h}'`).join(" "));
