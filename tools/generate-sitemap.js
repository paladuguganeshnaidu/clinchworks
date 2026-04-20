#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, ".."
);

const readText = (filePath) => fs.readFileSync(filePath, "utf8");

const formatDate = (d) => {
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const escapeXml = (s) => String(s)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/\"/g, "&quot;")
  .replace(/'/g, "&apos;");

const cnamePath = path.join(rootDir, "CNAME");
const domain = readText(cnamePath).trim();
if (!domain) {
  console.error("CNAME is empty; cannot generate sitemap.");
  process.exit(1);
}

const baseUrl = `https://${domain}`;
const lastmod = formatDate(new Date());

// Explicit allowlist of indexable routes (exclude auth/admin/dynamic pages).
const routes = [
  { loc: `${baseUrl}/`, changefreq: "weekly", priority: "1.0" },
  { loc: `${baseUrl}/services`, changefreq: "weekly", priority: "0.9" },

  { loc: `${baseUrl}/ai-development`, changefreq: "monthly", priority: "0.8" },
  { loc: `${baseUrl}/web-development`, changefreq: "monthly", priority: "0.8" },
  { loc: `${baseUrl}/web-hosting`, changefreq: "monthly", priority: "0.8" },
  { loc: `${baseUrl}/growth-optimization`, changefreq: "monthly", priority: "0.8" },

  { loc: `${baseUrl}/content-marketing`, changefreq: "monthly", priority: "0.7" },
  { loc: `${baseUrl}/google-ads`, changefreq: "monthly", priority: "0.7" },
  { loc: `${baseUrl}/social-media-marketing`, changefreq: "monthly", priority: "0.7" },
  { loc: `${baseUrl}/video-graphic-design`, changefreq: "monthly", priority: "0.7" },
  { loc: `${baseUrl}/website-design`, changefreq: "monthly", priority: "0.7" },
  { loc: `${baseUrl}/youtube-management`, changefreq: "monthly", priority: "0.7" },

  { loc: `${baseUrl}/training`, changefreq: "monthly", priority: "0.7" },
  { loc: `${baseUrl}/domain`, changefreq: "weekly", priority: "0.8" },
  { loc: `${baseUrl}/projects`, changefreq: "monthly", priority: "0.8" },
  { loc: `${baseUrl}/contact`, changefreq: "yearly", priority: "0.6" },
  { loc: `${baseUrl}/book-call`, changefreq: "yearly", priority: "0.6" }
];

const xml = [
  "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
  "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",
  ...routes.map((r) => [
    "  <url>",
    `    <loc>${escapeXml(r.loc)}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${escapeXml(r.changefreq)}</changefreq>`,
    `    <priority>${escapeXml(r.priority)}</priority>`,
    "  </url>"
  ].join("\n")),
  "</urlset>",
  ""
].join("\n");

const outPath = path.join(rootDir, "sitemap.xml");
fs.writeFileSync(outPath, xml, "utf8");
console.log(`Wrote ${routes.length} URLs to ${outPath}`);
