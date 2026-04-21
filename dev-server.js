const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const { pipeline } = require("stream");

const PORT = Number(process.env.PORT) || 8080;
const ROOT = path.resolve(__dirname);
const DATA_DIR = process.env.CW_DATA_DIR || "/var/lib/clinchworks-data";
const SESSION_DB_PATH = path.join(DATA_DIR, "sessions.json");
const LEADS_DB_PATH = path.join(DATA_DIR, "leads.json");

const SESSION_COOKIE_NAME = "cw_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 1024 * 1024;
const SESSION_SECRET = process.env.CW_SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60 * 1000;
const RATE_LIMIT_RULES = Object.freeze({
  writeGlobal: { limit: 240, windowMs: 60 * 1000 },
  contact: { limit: 10, windowMs: 10 * 60 * 1000 },
  bookCall: { limit: 10, windowMs: 10 * 60 * 1000 },
  sessionStart: { limit: 30, windowMs: 10 * 60 * 1000 },
  examSubmit: { limit: 20, windowMs: 5 * 60 * 1000 },
  certificateIssue: { limit: 10, windowMs: 10 * 60 * 1000 }
});
const PRIVATE_STATIC_FILES = new Set([
  "dev-server.js",
  "examquestions.json",
  ".htaccess",
  "firebase.json",
  "firestore.indexes.json",
  "firestore.rules",
  "functions/package.json",
  "functions/package-lock.json"
]);

const PRIVATE_STATIC_PREFIXES = [
  "functions/"
];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".mp4": "video/mp4",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function buildWeakEtag(stats) {
  return `W/\"${stats.size}-${Math.floor(stats.mtimeMs)}\"`;
}

function getCacheControl(publicPath, extname) {
  if (publicPath.startsWith("/assets/")) {
    return "public,max-age=31536000,immutable";
  }

  if (extname === ".html") {
    return "no-cache";
  }

  if (extname === ".json" || extname === ".xml") {
    return "no-cache";
  }

  return "no-cache";
}

function isCompressibleContentType(contentType) {
  if (!contentType) return false;
  return (
    contentType.startsWith("text/") ||
    contentType.startsWith("application/javascript") ||
    contentType.startsWith("application/json") ||
    contentType.startsWith("application/xml") ||
    contentType.startsWith("application/manifest+json") ||
    contentType.startsWith("image/svg+xml")
  );
}

function pickContentEncoding(req) {
  const acceptEncoding = String(req.headers["accept-encoding"] || "").toLowerCase();
  if (acceptEncoding.includes("br")) return "br";
  if (acceptEncoding.includes("gzip")) return "gzip";
  return null;
}

function createCompressionStream(encoding) {
  if (encoding === "br") {
    return zlib.createBrotliCompress({
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 5
      }
    });
  }
  if (encoding === "gzip") {
    return zlib.createGzip({ level: 6 });
  }
  return null;
}

function ensureDataStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SESSION_DB_PATH)) {
    const initial = { sessions: {} };
    fs.writeFileSync(SESSION_DB_PATH, JSON.stringify(initial, null, 2), "utf8");
  }
  if (!fs.existsSync(LEADS_DB_PATH)) {
    const initialLeads = { contact: [], bookCalls: [] };
    fs.writeFileSync(LEADS_DB_PATH, JSON.stringify(initialLeads, null, 2), "utf8");
  }
}

function loadSessionStore() {
  ensureDataStore();
  try {
    const raw = fs.readFileSync(SESSION_DB_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || typeof parsed.sessions !== "object") {
      return { sessions: {} };
    }
    return parsed;
  } catch (err) {
    return { sessions: {} };
  }
}

let sessionStore = loadSessionStore();
const rateLimitBuckets = new Map();
let lastRateLimitCleanupAt = 0;

function persistSessionStore() {
  try {
    fs.writeFileSync(SESSION_DB_PATH, JSON.stringify(sessionStore, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to persist session store:", err.message);
  }
}

function loadLeadStore() {
  ensureDataStore();
  try {
    const raw = fs.readFileSync(LEADS_DB_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { contact: [], bookCalls: [] };
    }
    if (!Array.isArray(parsed.contact)) parsed.contact = [];
    if (!Array.isArray(parsed.bookCalls)) parsed.bookCalls = [];
    return parsed;
  } catch (err) {
    return { contact: [], bookCalls: [] };
  }
}

let leadStore = loadLeadStore();

function persistLeadStore() {
  try {
    fs.writeFileSync(LEADS_DB_PATH, JSON.stringify(leadStore, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to persist lead store:", err.message);
  }
}

function sanitizeText(value, maxLen = 500) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  const safe = raw.replace(/[\u0000-\u001F\u007F]/g, "");
  return safe.slice(0, maxLen);
}

function sanitizeEmail(value) {
  return sanitizeText(value, 254).toLowerCase();
}

function sanitizePhone(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits.slice(0, 20);
}

function sanitizeCountryCode(value) {
  const code = String(value || "").trim();
  if (!/^\+\d{1,4}$/.test(code)) return "";
  return code;
}

function getClientIp(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "");
  const forwardedIp = forwardedFor.split(",").map((item) => item.trim()).find(Boolean);
  const ip = forwardedIp || String(req.socket?.remoteAddress || "unknown");
  return sanitizeText(ip, 80);
}

function cleanupRateLimitBuckets(now = Date.now()) {
  if ((now - lastRateLimitCleanupAt) < RATE_LIMIT_CLEANUP_INTERVAL_MS) {
    return;
  }

  lastRateLimitCleanupAt = now;
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (!bucket || typeof bucket !== "object" || now >= bucket.resetAt) {
      rateLimitBuckets.delete(key);
    }
  }
}

function consumeRateLimit(req, scope, limit, windowMs) {
  const now = Date.now();
  cleanupRateLimitBuckets(now);

  const key = `${scope}:${getClientIp(req)}`;
  let bucket = rateLimitBuckets.get(key);

  if (!bucket || typeof bucket !== "object" || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
  }

  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);

  return {
    allowed: bucket.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
  };
}

function enforceRateLimit(req, res, isHttps, noStoreHeaders, scope, rule, message) {
  const result = consumeRateLimit(req, scope, rule.limit, rule.windowMs);
  if (result.allowed) {
    return false;
  }

  sendJson(
    res,
    429,
    { error: message || "Too many requests. Please try again later." },
    isHttps,
    {
      ...noStoreHeaders,
      "Retry-After": String(result.retryAfterSeconds)
    }
  );

  return true;
}

function isValidEmail(value) {
  const email = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function appendLead(collectionName, entry) {
  if (!Array.isArray(leadStore[collectionName])) {
    leadStore[collectionName] = [];
  }
  leadStore[collectionName].push(entry);
  if (leadStore[collectionName].length > 5000) {
    leadStore[collectionName] = leadStore[collectionName].slice(-5000);
  }
  persistLeadStore();
}

function clampInt(value, min, max) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function buildSecurityHeaders(isHttps) {
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://www.gstatic.com 'sha256-/uH9eaHW33pFZt192hyYREvS0Sa3hEWAOvuOcbtlpME=' 'sha256-1V9OeVOgczaU1mkVyVpychYYRxedP/Wdx5a3dq3vD5s=' 'sha256-C5ry726bOCl5elxCqbrJpI0X/Nhn/sp0Lnyq6MfS4Kg=' 'sha256-ClMJFFMc3cVr188UPQRgEkRvqcWmbbkajP470VoCxQU=' 'sha256-HwV37WUTpx+6yiIJfTO7UJKy0fL2soLvFVjpNHvwcLw=' 'sha256-NAdMEbX60CC06HmZ4+iTx8hPmAIlx62rrQxZplagQhs=' 'sha256-NELZYEq1I23t0m7vC+I6FuyCs+6qdES3rNFdlwowIJY=' 'sha256-Ogei2FOlDBlRG3niHeZ0ZHOouV2JuVAED110T9ECBJg=' 'sha256-RHtye2qmNEs7Pmi+bDlpttnp6LXZzPlWysCQaPeSIVw=' 'sha256-WI9WUbBvx9KDFmINDQolhbAUquSnLOXSiMUNuJ5hJ9A=' 'sha256-Z9e72IcgVPv9DvgcvmKn3/jyYdb/b+0xGcfI09vGO34=' 'sha256-pvnggaYi7vBvwOI8arfVhcg+Oubw8nQx7lQX8HKJY7Q=' 'sha256-tCPdgxOvIa4r8PDzaACletZHhSjwbrcHT8MzFbjIYNI=' 'sha256-uWMk06ltVnAzH5qhmiUm9ucEclypCLeFwCOGI2OJuOU='; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com;"
  };

  if (isHttps) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }

  return headers;
}

function applySecurityHeaders(res, isHttps) {
  const headers = buildSecurityHeaders(isHttps);
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || "";
  const pairs = cookieHeader.split(";").map((p) => p.trim()).filter(Boolean);
  const cookies = {};
  pairs.forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx <= 0) return;
    const key = pair.slice(0, idx);
    const val = pair.slice(idx + 1);
    cookies[key] = val;
  });
  return cookies;
}

function signSessionId(sessionId) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(sessionId).digest("hex");
}

function timingSafeEqual(a, b) {
  const aa = Buffer.from(String(a), "utf8");
  const bb = Buffer.from(String(b), "utf8");
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function serializeSessionCookie(cookieValue, isHttps) {
  const attrs = [
    `${SESSION_COOKIE_NAME}=${cookieValue}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=2592000"
  ];
  if (isHttps) {
    attrs.push("Secure");
  }
  return attrs.join("; ");
}

function isPathInside(baseDir, targetPath) {
  const relative = path.relative(baseDir, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function hasHiddenPathSegment(relativePath) {
  const segments = String(relativePath || "").split("/").filter(Boolean);
  return segments.some((segment) => segment.startsWith(".") && segment !== ".well-known");
}

function isTrustedWriteRequest(req) {
  const method = String(req.method || "GET").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return true;
  }

  const host = String(req.headers.host || "").toLowerCase();
  if (!host) {
    return false;
  }

  const originHeader = String(req.headers.origin || "").trim();
  const refererHeader = String(req.headers.referer || "").trim();
  const contentType = String(req.headers["content-type"] || "").toLowerCase();

  if (!contentType.includes("application/json")) {
    return false;
  }

  if (originHeader) {
    try {
      const origin = new URL(originHeader);
      if (origin.host.toLowerCase() !== host) {
        return false;
      }
    } catch (err) {
      return false;
    }
  }

  if (refererHeader) {
    try {
      const referer = new URL(refererHeader);
      if (referer.host.toLowerCase() !== host) {
        return false;
      }
    } catch (err) {
      return false;
    }
  }

  const secFetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  if (secFetchSite && !["same-origin", "same-site", "none"].includes(secFetchSite)) {
    return false;
  }

  if (!originHeader && !refererHeader && !secFetchSite) {
    return false;
  }

  return true;
}

function cleanupExpiredSessions() {
  const now = Date.now();
  let changed = false;
  Object.keys(sessionStore.sessions).forEach((sid) => {
    const sess = sessionStore.sessions[sid];
    if (!sess || typeof sess !== "object") {
      delete sessionStore.sessions[sid];
      changed = true;
      return;
    }
    if ((now - (sess.lastSeen || sess.createdAt || now)) > SESSION_TTL_MS) {
      delete sessionStore.sessions[sid];
      changed = true;
    }
  });
  if (changed) persistSessionStore();
}

function getOrCreateSession(req, res, isHttps) {
  cleanupExpiredSessions();
  const cookies = parseCookies(req);
  const raw = cookies[SESSION_COOKIE_NAME] || "";
  let sessionId = null;

  if (raw.includes(".")) {
    const [sid, sig] = raw.split(".");
    if (sid && sig && timingSafeEqual(signSessionId(sid), sig) && sessionStore.sessions[sid]) {
      sessionId = sid;
    }
  }

  if (!sessionId) {
    sessionId = crypto.randomBytes(24).toString("hex");
    sessionStore.sessions[sessionId] = {
      username: "",
      createdAt: Date.now(),
      lastSeen: Date.now(),
      courses: {}
    };
    persistSessionStore();
  }

  const session = sessionStore.sessions[sessionId];
  session.lastSeen = Date.now();
  persistSessionStore();

  const cookieValue = `${sessionId}.${signSessionId(sessionId)}`;
  res.setHeader("Set-Cookie", serializeSessionCookie(cookieValue, isHttps));

  return { sessionId, session };
}

function readJsonFile(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

function getCourseCatalog() {
  return readJsonFile(path.join(ROOT, "courses-content.json"), { courses: [] });
}

function getExamCatalog() {
  return readJsonFile(path.join(ROOT, "examquestions.json"), {});
}

function findCourse(courseId) {
  const catalog = getCourseCatalog();
  if (!catalog || !Array.isArray(catalog.courses)) return null;
  return catalog.courses.find((course) => course && course.id === courseId) || null;
}

function sanitizeName(name) {
  const raw = String(name || "").replace(/\s+/g, " ").trim();
  const safe = raw.replace(/[^a-zA-Z0-9 .,'-]/g, "");
  return safe.slice(0, 80);
}

function defaultCourseState(totalModules) {
  return {
    currentModule: 0,
    totalModules: Number.isInteger(totalModules) ? Math.max(0, totalModules) : 0,
    completed: false,
    examPassed: false,
    certificateIssued: false,
    updatedAt: Date.now()
  };
}

function ensureCourseState(session, courseId, totalModules) {
  if (!session.courses || typeof session.courses !== "object") {
    session.courses = {};
  }
  if (!session.courses[courseId]) {
    session.courses[courseId] = defaultCourseState(totalModules);
  }

  const state = session.courses[courseId];
  const normalizedTotal = Number.isInteger(totalModules) ? Math.max(0, totalModules) : Math.max(0, Number.parseInt(state.totalModules, 10) || 0);
  const maxIndex = Math.max(0, normalizedTotal - 1);

  state.totalModules = normalizedTotal;
  state.currentModule = clampInt(state.currentModule, 0, maxIndex);
  state.completed = !!state.completed;
  state.examPassed = !!state.examPassed;
  state.certificateIssued = !!state.certificateIssued;
  state.updatedAt = Date.now();

  return state;
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch (err) {
    return null;
  }
}

function normalizePublicPath(rawPath) {
  const withSlashes = String(rawPath || "/").replace(/\\/g, "/");
  const prefixed = withSlashes.startsWith("/") ? withSlashes : `/${withSlashes}`;
  return path.posix.normalize(prefixed);
}

function sendJson(res, statusCode, payload, isHttps, extraHeaders = {}) {
  applySecurityHeaders(res, isHttps);
  Object.entries(extraHeaders).forEach(([k, v]) => {
    res.setHeader(k, v);
  });
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        reject(new Error("PAYLOAD_TOO_LARGE"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", (err) => reject(err));
  });
}

async function parseJsonBody(req) {
  const raw = await readRequestBody(req);
  if (!raw || !raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error("INVALID_JSON");
  }
}

function redirectExtensionless(req, res, pathname, isHttps) {
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return false;

  if (!pathname.endsWith(".html")) return false;

  let target;

  // Canonicalize nested /pages/<slug>.html directly to /<slug>.
  if (pathname.startsWith("/pages/") && !pathname.slice("/pages/".length).includes("/")) {
    const slug = pathname.slice("/pages/".length).replace(/\.html$/, "");
    target = `/${slug}`;
  } else if (pathname.endsWith("/index.html")) {
    target = pathname.replace(/index\.html$/, "");
    if (!target) target = "/";
  } else {
    target = pathname.replace(/\.html$/, "");
  }

  target = normalizePublicPath(target);
  if (!target.startsWith("/")) target = `/${target}`;
  if (target.startsWith("//")) target = `/${target.replace(/^\/+/, "")}`;

  applySecurityHeaders(res, isHttps);
  res.statusCode = 301;
  res.setHeader("Location", target);
  res.end();
  return true;
}

function redirectPagesToCanonical(req, res, pathname, isHttps) {
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return false;

  if (!pathname.startsWith("/pages/")) return false;

  const rest = pathname.slice("/pages/".length).replace(/^\/+/, "").replace(/\/+$/, "");
  if (!rest) return false;
  if (rest.includes("/")) return false;

  const candidate = path.join(ROOT, "pages", `${rest}.html`);
  try {
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) return false;
  } catch {
    return false;
  }

  applySecurityHeaders(res, isHttps);
  res.statusCode = 301;
  res.setHeader("Location", `/${rest}`);
  res.end();
  return true;
}

async function handleApi(req, res, requestUrl, isHttps, sessionCtx) {
  const { session } = sessionCtx;
  const method = (req.method || "GET").toUpperCase();
  const pathname = requestUrl.pathname;

  const noStore = { "Cache-Control": "no-store" };
  const isWriteMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  if (!isTrustedWriteRequest(req)) {
    return sendJson(res, 403, { error: "Cross-origin write request blocked" }, isHttps, noStore);
  }

  if (isWriteMethod && enforceRateLimit(req, res, isHttps, noStore, "api-write", RATE_LIMIT_RULES.writeGlobal)) {
    return;
  }

  if (method === "GET" && pathname === "/api/session") {
    return sendJson(res, 200, { username: session.username || "" }, isHttps, noStore);
  }

  if (method === "POST" && pathname === "/api/contact") {
    if (enforceRateLimit(req, res, isHttps, noStore, "contact", RATE_LIMIT_RULES.contact, "Too many contact requests. Please try again later.")) {
      return;
    }

    let body;
    try {
      body = await parseJsonBody(req);
    } catch (err) {
      const status = err.message === "PAYLOAD_TOO_LARGE" ? 413 : 400;
      return sendJson(res, status, { error: "Invalid request body" }, isHttps, noStore);
    }

    const name = sanitizeText(body.name, 120);
    const email = sanitizeEmail(body.email);
    const service = sanitizeText(body.service || "general", 80);
    const details = sanitizeText(body.details, 4000);

    if (name.length < 2) {
      return sendJson(res, 400, { error: "Valid name is required" }, isHttps, noStore);
    }
    if (!isValidEmail(email)) {
      return sendJson(res, 400, { error: "Valid email is required" }, isHttps, noStore);
    }
    if (details.length < 10) {
      return sendJson(res, 400, { error: "Please provide more project details" }, isHttps, noStore);
    }

    appendLead("contact", {
      id: crypto.randomBytes(10).toString("hex"),
      name,
      email,
      service,
      details,
      createdAt: new Date().toISOString(),
      ip: String(req.socket?.remoteAddress || ""),
      userAgent: sanitizeText(req.headers["user-agent"] || "", 300)
    });

    return sendJson(res, 200, { ok: true, message: "Contact request submitted successfully" }, isHttps, noStore);
  }

  if (method === "POST" && pathname === "/api/book-call") {
    if (enforceRateLimit(req, res, isHttps, noStore, "book-call", RATE_LIMIT_RULES.bookCall, "Too many call requests. Please try again later.")) {
      return;
    }

    let body;
    try {
      body = await parseJsonBody(req);
    } catch (err) {
      const status = err.message === "PAYLOAD_TOO_LARGE" ? 413 : 400;
      return sendJson(res, status, { error: "Invalid request body" }, isHttps, noStore);
    }

    const name = sanitizeText(body.name, 120);
    const mobile = sanitizePhone(body.mobile);
    const service = sanitizeText(body.service, 120);
    const whatsapp = sanitizePhone(body.whatsapp);
    const description = sanitizeText(body.description, 4000);

    if (name.length < 2) {
      return sendJson(res, 400, { error: "Valid full name is required" }, isHttps, noStore);
    }
    if (mobile.length < 7 || mobile.length > 15) {
      return sendJson(res, 400, { error: "Valid mobile number is required" }, isHttps, noStore);
    }

    const commonLead = {
      id: crypto.randomBytes(10).toString("hex"),
      name,
      mobile,
      createdAt: new Date().toISOString(),
      ip: String(req.socket?.remoteAddress || ""),
      userAgent: sanitizeText(req.headers["user-agent"] || "", 300)
    };

    const isBookingPayload = service.length > 0 || whatsapp.length > 0 || description.length > 0;

    if (isBookingPayload) {
      if (!service) {
        return sendJson(res, 400, { error: "Valid service is required" }, isHttps, noStore);
      }
      if (whatsapp.length < 7 || whatsapp.length > 15) {
        return sendJson(res, 400, { error: "Valid WhatsApp number is required" }, isHttps, noStore);
      }
      if (description.length < 5) {
        return sendJson(res, 400, { error: "Please add a short project description" }, isHttps, noStore);
      }

      appendLead("bookCalls", {
        ...commonLead,
        service,
        whatsapp,
        description,
        status: "active"
      });

      return sendJson(res, 200, { ok: true, message: "Booking request submitted successfully" }, isHttps, noStore);
    }

    // Backward-compatible payload shape.
    const countryCode = sanitizeCountryCode(body.countryCode);
    const address = sanitizeText(body.address, 500);
    if (!countryCode) {
      return sendJson(res, 400, { error: "Valid country code is required" }, isHttps, noStore);
    }

    appendLead("bookCalls", {
      ...commonLead,
      countryCode,
      address
    });

    return sendJson(res, 200, { ok: true, message: "Call request submitted successfully" }, isHttps, noStore);
  }

  if (method === "POST" && pathname === "/api/session/start") {
    if (enforceRateLimit(req, res, isHttps, noStore, "session-start", RATE_LIMIT_RULES.sessionStart, "Too many session starts. Please wait and try again.")) {
      return;
    }

    let body;
    try {
      body = await parseJsonBody(req);
    } catch (err) {
      const status = err.message === "PAYLOAD_TOO_LARGE" ? 413 : 400;
      return sendJson(res, status, { error: "Invalid request body" }, isHttps, noStore);
    }

    const courseId = String(body.courseId || "").trim();
    const name = sanitizeName(body.name || "");

    if (!courseId) {
      return sendJson(res, 400, { error: "courseId is required" }, isHttps, noStore);
    }

    const course = findCourse(courseId);
    if (!course) {
      return sendJson(res, 404, { error: "Course not found" }, isHttps, noStore);
    }

    if (name.length < 2) {
      return sendJson(res, 400, { error: "Valid name is required" }, isHttps, noStore);
    }

    session.username = name;
    ensureCourseState(session, courseId, Array.isArray(course.modules) ? course.modules.length : 0);
    persistSessionStore();

    return sendJson(res, 200, { ok: true }, isHttps, noStore);
  }

  if (method === "GET" && pathname === "/api/progress") {
    const courseId = String(requestUrl.searchParams.get("courseId") || "").trim();
    if (!courseId) {
      return sendJson(res, 400, { error: "courseId is required" }, isHttps, noStore);
    }

    const course = findCourse(courseId);
    if (!course) {
      return sendJson(res, 404, { error: "Course not found" }, isHttps, noStore);
    }

    const state = ensureCourseState(session, courseId, Array.isArray(course.modules) ? course.modules.length : 0);
    persistSessionStore();

    return sendJson(res, 200, { state }, isHttps, noStore);
  }

  if (method === "GET" && pathname === "/api/progress/all") {
    const response = {};
    const catalog = getCourseCatalog();
    const courses = Array.isArray(catalog.courses) ? catalog.courses : [];

    courses.forEach((course) => {
      if (!course || !course.id) return;
      const state = ensureCourseState(session, course.id, Array.isArray(course.modules) ? course.modules.length : 0);
      response[course.id] = state;
    });

    persistSessionStore();
    return sendJson(res, 200, { courses: response }, isHttps, noStore);
  }

  if (method === "POST" && pathname === "/api/progress") {
    let body;
    try {
      body = await parseJsonBody(req);
    } catch (err) {
      const status = err.message === "PAYLOAD_TOO_LARGE" ? 413 : 400;
      return sendJson(res, status, { error: "Invalid request body" }, isHttps, noStore);
    }

    const courseId = String(body.courseId || "").trim();
    if (!courseId) {
      return sendJson(res, 400, { error: "courseId is required" }, isHttps, noStore);
    }

    const course = findCourse(courseId);
    if (!course) {
      return sendJson(res, 404, { error: "Course not found" }, isHttps, noStore);
    }

    const totalModules = Array.isArray(course.modules) ? course.modules.length : 0;
    const maxIndex = Math.max(0, totalModules - 1);

    const incoming = body.state && typeof body.state === "object" ? body.state : body;
    const state = ensureCourseState(session, courseId, totalModules);

    const requestedCurrent = clampInt(incoming.currentModule, 0, maxIndex);
    const requestedCompleted = !!incoming.completed;

    state.currentModule = Math.max(state.currentModule, requestedCurrent);
    state.completed = state.completed || (requestedCompleted && state.currentModule >= maxIndex);
    state.totalModules = totalModules;
    state.updatedAt = Date.now();

    persistSessionStore();
    return sendJson(res, 200, { state }, isHttps, noStore);
  }

  if (method === "GET" && pathname === "/api/exam/questions") {
    const courseId = String(requestUrl.searchParams.get("courseId") || "").trim();
    if (!courseId) {
      return sendJson(res, 400, { error: "courseId is required" }, isHttps, noStore);
    }

    const course = findCourse(courseId);
    if (!course) {
      return sendJson(res, 404, { error: "Course not found" }, isHttps, noStore);
    }

    const state = ensureCourseState(session, courseId, Array.isArray(course.modules) ? course.modules.length : 0);
    if (!state.completed) {
      return sendJson(res, 403, { error: "Complete the course before taking the exam" }, isHttps, noStore);
    }

    const examCatalog = getExamCatalog();
    const exam = examCatalog[courseId];
    if (!exam) {
      return sendJson(res, 404, { error: "No exam found for this course" }, isHttps, noStore);
    }

    const mcq = Array.isArray(exam.mcq) ? exam.mcq.map((item) => ({
      q: String(item.q || ""),
      options: Array.isArray(item.options) ? item.options.map((opt) => String(opt || "")) : []
    })) : [];

    const coding = Array.isArray(exam.coding) ? exam.coding.map((item) => ({
      id: String(item.id || ""),
      q: String(item.q || "")
    })) : [];

    return sendJson(res, 200, { mcq, coding }, isHttps, noStore);
  }

  if (method === "POST" && pathname === "/api/exam/submit") {
    if (enforceRateLimit(req, res, isHttps, noStore, "exam-submit", RATE_LIMIT_RULES.examSubmit, "Too many exam submissions. Please wait and try again.")) {
      return;
    }

    let body;
    try {
      body = await parseJsonBody(req);
    } catch (err) {
      const status = err.message === "PAYLOAD_TOO_LARGE" ? 413 : 400;
      return sendJson(res, status, { error: "Invalid request body" }, isHttps, noStore);
    }

    const courseId = String(body.courseId || "").trim();
    if (!courseId) {
      return sendJson(res, 400, { error: "courseId is required" }, isHttps, noStore);
    }

    const course = findCourse(courseId);
    if (!course) {
      return sendJson(res, 404, { error: "Course not found" }, isHttps, noStore);
    }

    const state = ensureCourseState(session, courseId, Array.isArray(course.modules) ? course.modules.length : 0);
    if (!state.completed) {
      return sendJson(res, 403, { error: "Course must be completed before exam submission" }, isHttps, noStore);
    }

    const examCatalog = getExamCatalog();
    const exam = examCatalog[courseId];
    if (!exam) {
      return sendJson(res, 404, { error: "No exam found for this course" }, isHttps, noStore);
    }

    const submittedAnswers = body.answers && typeof body.answers === "object" ? body.answers : {};
    const submittedMcq = Array.isArray(submittedAnswers.mcq) ? submittedAnswers.mcq : [];
    const submittedCoding = submittedAnswers.coding && typeof submittedAnswers.coding === "object" ? submittedAnswers.coding : {};

    let score = 0;

    const mcq = Array.isArray(exam.mcq) ? exam.mcq : [];
    mcq.forEach((question, idx) => {
      const submitted = Number.parseInt(submittedMcq[idx], 10);
      if (!Number.isNaN(submitted) && submitted === Number.parseInt(question.ans, 10)) {
        score += 1;
      }
    });

    const coding = Array.isArray(exam.coding) ? exam.coding : [];
    coding.forEach((question) => {
      const qid = String(question.id || "");
      const answer = String(submittedCoding[qid] || "").toLowerCase();
      const keywords = Array.isArray(question.keywords) ? question.keywords : [];
      const matched = keywords.some((kw) => answer.includes(String(kw || "").toLowerCase()));
      if (matched) {
        score += 1;
      }
    });

    const total = mcq.length + coding.length;
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
    const passed = percentage >= 60;

    if (passed) {
      state.examPassed = true;
      state.completed = true;
    }

    state.updatedAt = Date.now();
    persistSessionStore();

    return sendJson(res, 200, { score, total, percentage, passed }, isHttps, noStore);
  }

  if (method === "GET" && pathname === "/api/certificate/status") {
    const courseId = String(requestUrl.searchParams.get("courseId") || "").trim();
    if (!courseId) {
      return sendJson(res, 400, { error: "courseId is required" }, isHttps, noStore);
    }

    const course = findCourse(courseId);
    if (!course) {
      return sendJson(res, 404, { error: "Course not found" }, isHttps, noStore);
    }

    const state = ensureCourseState(session, courseId, Array.isArray(course.modules) ? course.modules.length : 0);
    persistSessionStore();

    return sendJson(res, 200, {
      completed: !!state.completed,
      examPassed: !!state.examPassed,
      certificateIssued: !!state.certificateIssued,
      username: session.username || ""
    }, isHttps, noStore);
  }

  if (method === "POST" && pathname === "/api/certificate/issue") {
    if (enforceRateLimit(req, res, isHttps, noStore, "certificate-issue", RATE_LIMIT_RULES.certificateIssue, "Too many certificate requests. Please wait and try again.")) {
      return;
    }

    let body;
    try {
      body = await parseJsonBody(req);
    } catch (err) {
      const status = err.message === "PAYLOAD_TOO_LARGE" ? 413 : 400;
      return sendJson(res, status, { error: "Invalid request body" }, isHttps, noStore);
    }

    const courseId = String(body.courseId || "").trim();
    if (!courseId) {
      return sendJson(res, 400, { error: "courseId is required" }, isHttps, noStore);
    }

    const course = findCourse(courseId);
    if (!course) {
      return sendJson(res, 404, { error: "Course not found" }, isHttps, noStore);
    }

    const state = ensureCourseState(session, courseId, Array.isArray(course.modules) ? course.modules.length : 0);
    if (!state.examPassed) {
      return sendJson(res, 403, { error: "Exam must be passed before issuing certificate" }, isHttps, noStore);
    }

    const alreadyIssued = !!state.certificateIssued;
    state.certificateIssued = true;
    state.updatedAt = Date.now();
    persistSessionStore();

    return sendJson(res, 200, { issued: true, alreadyIssued }, isHttps, noStore);
  }

  return sendJson(res, 404, { error: "API route not found" }, isHttps, noStore);
}

const server = http.createServer(async (req, res) => {
  const isHttps = !!(req.socket && req.socket.encrypted) || req.headers["x-forwarded-proto"] === "https";

  let requestUrl;
  try {
    requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  } catch (err) {
    return sendJson(res, 400, { error: "Invalid request URL" }, isHttps);
  }

  const decoded = safeDecodeURIComponent(requestUrl.pathname);
  if (decoded === null || String(decoded).includes("\0")) {
    return sendJson(res, 400, { error: "Bad request path" }, isHttps);
  }

  const pathname = normalizePublicPath(decoded);

  if (pathname.startsWith("/api/")) {
    const sessionCtx = getOrCreateSession(req, res, isHttps);
    return handleApi(req, res, requestUrl, isHttps, sessionCtx);
  }

  if (redirectExtensionless(req, res, pathname, isHttps)) {
    return;
  }

  if (redirectPagesToCanonical(req, res, pathname, isHttps)) {
    return;
  }

  const publicPath = pathname;
  let filePath = path.resolve(ROOT, `.${publicPath}`);

  if (!isPathInside(ROOT, filePath) || isPathInside(DATA_DIR, filePath)) {
    applySecurityHeaders(res, isHttps);
    res.statusCode = 403;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("Forbidden");
  }

  let extname = path.extname(filePath).toLowerCase();

  if (publicPath === "/" || (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory())) {
    filePath = path.join(filePath, "index.html");
    extname = ".html";
  } else if (!extname) {
    if (!publicPath.startsWith("/pages/")) {
      const candidateSlug = publicPath.replace(/^\/+/, "");
      const pagesCandidate = path.join(ROOT, "pages", `${candidateSlug}.html`);
      if (fs.existsSync(pagesCandidate) && fs.statSync(pagesCandidate).isFile()) {
        filePath = pagesCandidate;
        extname = ".html";
      }
    }

    if (!extname) {
      const htmlCandidate = `${filePath}.html`;
      if (fs.existsSync(htmlCandidate) && fs.statSync(htmlCandidate).isFile()) {
        filePath = htmlCandidate;
        extname = ".html";
      }
    }
  }

  const relativePath = path.relative(ROOT, filePath).replace(/\\/g, "/");
  const relativePathLower = relativePath.toLowerCase();
  const isPrivatePrefix = PRIVATE_STATIC_PREFIXES.some((prefix) => relativePathLower.startsWith(prefix));

  if (!relativePath || hasHiddenPathSegment(relativePath) || PRIVATE_STATIC_FILES.has(relativePathLower) || isPrivatePrefix) {
    applySecurityHeaders(res, isHttps);
    res.statusCode = 403;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("Forbidden");
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    const custom404Candidates = [
      path.join(ROOT, "pages", "404.html"),
      path.join(ROOT, "404.html")
    ];

    const custom404Path = custom404Candidates.find((candidate) => {
      try {
        return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
      } catch {
        return false;
      }
    });

    applySecurityHeaders(res, isHttps);
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");

    if (custom404Path) {
      try {
        return res.end(fs.readFileSync(custom404Path));
      } catch (err) {
        return res.end("<h1>404 Not Found</h1>");
      }
    }

    return res.end("<h1>404 Not Found</h1>");
  }

  const contentType = mimeTypes[extname] || "application/octet-stream";

  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch (err) {
    applySecurityHeaders(res, isHttps);
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end(`Server Error: ${err.code || "UNKNOWN"}`);
  }

  const etag = buildWeakEtag(stats);
  const ifNoneMatch = String(req.headers["if-none-match"] || "");
  const method = (req.method || "GET").toUpperCase();

  // Prevent accidental indexing of partials.
  const isPartials = publicPath.startsWith("/assets/partials/");

  // Range requests for streaming-friendly media.
  const rangeHeader = String(req.headers.range || "");
  const hasRange = rangeHeader.startsWith("bytes=");

  // Compression for text-like assets (only when not serving ranges).
  const encoding = !hasRange ? pickContentEncoding(req) : null;
  const shouldCompress = !hasRange && encoding && isCompressibleContentType(contentType) && stats.size > 1024;

  applySecurityHeaders(res, isHttps);
  res.setHeader("Content-Type", contentType);
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", getCacheControl(publicPath, extname));
  if (isPartials) {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
  }

  if (ifNoneMatch && ifNoneMatch === etag && (method === "GET" || method === "HEAD")) {
    res.statusCode = 304;
    return res.end();
  }

  if (hasRange && stats.size > 0) {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader);
    if (!match) {
      res.statusCode = 416;
      res.setHeader("Content-Range", `bytes */${stats.size}`);
      return res.end();
    }

    let start = match[1] ? Number.parseInt(match[1], 10) : 0;
    let end = match[2] ? Number.parseInt(match[2], 10) : stats.size - 1;

    if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end < 0 || start > end || start >= stats.size) {
      res.statusCode = 416;
      res.setHeader("Content-Range", `bytes */${stats.size}`);
      return res.end();
    }

    end = Math.min(end, stats.size - 1);
    const chunkSize = end - start + 1;

    res.statusCode = 206;
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Range", `bytes ${start}-${end}/${stats.size}`);
    res.setHeader("Content-Length", String(chunkSize));

    if (method === "HEAD") {
      return res.end();
    }

    const stream = fs.createReadStream(filePath, { start, end });
    stream.on("error", () => {
      if (!res.headersSent) res.statusCode = 500;
      res.end();
    });
    return stream.pipe(res);
  }

  if (shouldCompress) {
    res.setHeader("Content-Encoding", encoding);
    res.setHeader("Vary", "Accept-Encoding");

    if (method === "HEAD") {
      res.statusCode = 200;
      return res.end();
    }

    const compressor = createCompressionStream(encoding);
    const src = fs.createReadStream(filePath);
    pipeline(src, compressor, res, () => {});
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Length", String(stats.size));

  if (method === "HEAD") {
    return res.end();
  }

  const stream = fs.createReadStream(filePath);
  stream.on("error", (err) => {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.end(`Server Error: ${err.code || "UNKNOWN"}`);
    }
    res.end();
  });

  stream.pipe(res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Secure development server running at http://localhost:${PORT}`);
});

