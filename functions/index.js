const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

const fs = require("fs");
const path = require("path");

admin.initializeApp();
const db = admin.firestore();

function sendJson(res, status, payload) {
  res.set("Cache-Control", "no-store");
  res.status(status).json(payload);
}

function readJsonFile(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

const COURSE_CATALOG = readJsonFile(path.join(__dirname, "data", "courses-content.json"), { courses: [] });
const EXAM_CATALOG = readJsonFile(path.join(__dirname, "data", "examquestions.json"), {});

function findCourse(courseId) {
  if (!COURSE_CATALOG || !Array.isArray(COURSE_CATALOG.courses)) return null;
  return COURSE_CATALOG.courses.find((course) => course && course.id === courseId) || null;
}

function getBearerToken(req) {
  const header = String(req.get("authorization") || "").trim();
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

async function requireAuth(req, res) {
  const token = getBearerToken(req);
  if (!token) {
    sendJson(res, 401, { error: "Missing Authorization bearer token" });
    return null;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    if (!decoded || !decoded.uid) {
      sendJson(res, 401, { error: "Invalid token" });
      return null;
    }
    return decoded;
  } catch (err) {
    logger.warn("verifyIdToken failed", err);
    sendJson(res, 401, { error: "Invalid token" });
    return null;
  }
}

function parseJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const raw = req.rawBody ? req.rawBody.toString("utf8") : "";
  if (!raw) return {};
  return JSON.parse(raw);
}

function clampInt(value, min, max) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function normalizeProgressState(raw, totalModules) {
  const safeTotal = Number.isInteger(totalModules)
    ? Math.max(0, totalModules)
    : Math.max(0, Number.parseInt(raw && raw.totalModules, 10) || 0);

  const maxIndex = Math.max(0, safeTotal - 1);
  const currentModule = clampInt(raw && raw.currentModule, 0, maxIndex);

  const completedRequested = !!(raw && raw.completed);
  const completed = completedRequested && (safeTotal === 0 ? true : currentModule >= maxIndex);

  return {
    currentModule,
    totalModules: safeTotal,
    completed,
    examPassed: !!(raw && raw.examPassed),
    certificateIssued: !!(raw && raw.certificateIssued)
  };
}

async function resolveUsername(uid, decodedToken) {
  try {
    const snap = await db.collection("users").doc(uid).get();
    if (snap.exists) {
      const data = snap.data() || {};
      const first = String(data.firstName || "").trim();
      const last = String(data.lastName || "").trim();
      const joined = `${first} ${last}`.trim();
      if (joined) return joined;
    }
  } catch (err) {
    logger.warn("resolveUsername: users doc read failed", err);
  }

  const nameFromToken = String((decodedToken && (decodedToken.name || decodedToken.displayName)) || "").trim();
  if (nameFromToken) return nameFromToken;

  const email = String((decodedToken && decodedToken.email) || "").trim();
  if (email && email.includes("@")) return email.split("@")[0];

  return "Student";
}

exports.api = onRequest(
  {
    region: "asia-south1",
    cors: false,
    maxInstances: 10
  },
  async (req, res) => {
    const method = String(req.method || "GET").toUpperCase();
    const pathname = String(req.path || "/");

    // Only accept /api/*
    if (!pathname.startsWith("/api/")) {
      return sendJson(res, 404, { error: "Not found" });
    }

    // Public endpoint: contact form.
    if (method === "POST" && pathname === "/api/contact") {
      let body;
      try {
        body = parseJsonBody(req);
      } catch (err) {
        return sendJson(res, 400, { error: "Invalid JSON" });
      }

      const name = String(body.name || "").trim().slice(0, 120);
      const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
      const service = String(body.service || "general").trim().toLowerCase().slice(0, 80);
      const details = String(body.details || "").trim().slice(0, 2000);

      if (!name || !email || !details) {
        return sendJson(res, 400, { error: "name, email, details are required" });
      }

      try {
        await db.collection("contactMessages").add({
          name,
          email,
          service,
          details,
          status: "new",
          page: String(body.page || "").trim().slice(0, 200),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return sendJson(res, 200, { ok: true });
      } catch (err) {
        logger.error("/api/contact failed", err);
        return sendJson(res, 500, { error: "Server error" });
      }
    }

    const decoded = await requireAuth(req, res);
    if (!decoded) return;

    const uid = decoded.uid;

    if (method === "GET" && pathname === "/api/session") {
      const username = await resolveUsername(uid, decoded);
      return sendJson(res, 200, { uid, username });
    }

    if (method === "POST" && pathname === "/api/session/start") {
      // Keep endpoint for compatibility; Firestore-backed progress handles state.
      return sendJson(res, 200, { ok: true });
    }

    if (method === "GET" && pathname === "/api/progress") {
      const courseId = String(req.query.courseId || "").trim();
      if (!courseId) return sendJson(res, 400, { error: "courseId is required" });

      try {
        const ref = db.collection("users").doc(uid).collection("progress").doc(courseId);
        const snap = await ref.get();
        const course = findCourse(courseId);
        const totalModules = course && Array.isArray(course.modules) ? course.modules.length : 0;

        const state = snap.exists ? normalizeProgressState(snap.data() || {}, totalModules) : normalizeProgressState({}, totalModules);
        return sendJson(res, 200, { state });
      } catch (err) {
        logger.error("/api/progress GET failed", err);
        return sendJson(res, 500, { error: "Server error" });
      }
    }

    if (method === "POST" && pathname === "/api/progress") {
      let body;
      try {
        body = parseJsonBody(req);
      } catch (err) {
        return sendJson(res, 400, { error: "Invalid JSON" });
      }

      const courseId = String(body.courseId || "").trim();
      if (!courseId) return sendJson(res, 400, { error: "courseId is required" });

      const incoming = body.state && typeof body.state === "object" ? body.state : body;
      const course = findCourse(courseId);
      const totalModules = course && Array.isArray(course.modules) ? course.modules.length : 0;

      const normalized = normalizeProgressState(incoming, totalModules);

      try {
        const ref = db.collection("users").doc(uid).collection("progress").doc(courseId);
        await ref.set(
          {
            ...normalized,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        return sendJson(res, 200, { state: normalized });
      } catch (err) {
        logger.error("/api/progress POST failed", err);
        return sendJson(res, 500, { error: "Server error" });
      }
    }

    if (method === "GET" && pathname === "/api/progress/all") {
      try {
        const snap = await db.collection("users").doc(uid).collection("progress").get();
        const courses = {};

        snap.forEach((docSnap) => {
          const courseId = docSnap.id;
          const course = findCourse(courseId);
          const totalModules = course && Array.isArray(course.modules) ? course.modules.length : 0;
          courses[courseId] = normalizeProgressState(docSnap.data() || {}, totalModules);
        });

        return sendJson(res, 200, { courses });
      } catch (err) {
        logger.error("/api/progress/all failed", err);
        return sendJson(res, 500, { error: "Server error" });
      }
    }

    if (method === "GET" && pathname === "/api/exam/questions") {
      const courseId = String(req.query.courseId || "").trim();
      if (!courseId) return sendJson(res, 400, { error: "courseId is required" });

      const course = findCourse(courseId);
      if (!course) return sendJson(res, 404, { error: "Course not found" });

      try {
        const progressRef = db.collection("users").doc(uid).collection("progress").doc(courseId);
        const progressSnap = await progressRef.get();
        const totalModules = Array.isArray(course.modules) ? course.modules.length : 0;
        const state = progressSnap.exists ? normalizeProgressState(progressSnap.data() || {}, totalModules) : normalizeProgressState({}, totalModules);

        if (!state.completed) {
          return sendJson(res, 403, { error: "Complete the course before taking the exam" });
        }

        const exam = EXAM_CATALOG[courseId];
        if (!exam) {
          return sendJson(res, 404, { error: "No exam found for this course" });
        }

        const mcq = Array.isArray(exam.mcq)
          ? exam.mcq.map((item) => ({
              q: String(item.q || ""),
              options: Array.isArray(item.options) ? item.options.map((opt) => String(opt || "")) : []
            }))
          : [];

        const coding = Array.isArray(exam.coding)
          ? exam.coding.map((item) => ({
              id: String(item.id || ""),
              q: String(item.q || "")
            }))
          : [];

        return sendJson(res, 200, { mcq, coding });
      } catch (err) {
        logger.error("/api/exam/questions failed", err);
        return sendJson(res, 500, { error: "Server error" });
      }
    }

    if (method === "POST" && pathname === "/api/exam/submit") {
      let body;
      try {
        body = parseJsonBody(req);
      } catch (err) {
        return sendJson(res, 400, { error: "Invalid JSON" });
      }

      const courseId = String(body.courseId || "").trim();
      if (!courseId) return sendJson(res, 400, { error: "courseId is required" });

      const course = findCourse(courseId);
      if (!course) return sendJson(res, 404, { error: "Course not found" });

      const exam = EXAM_CATALOG[courseId];
      if (!exam) return sendJson(res, 404, { error: "No exam found for this course" });

      try {
        const progressRef = db.collection("users").doc(uid).collection("progress").doc(courseId);
        const progressSnap = await progressRef.get();
        const totalModules = Array.isArray(course.modules) ? course.modules.length : 0;
        const state = progressSnap.exists ? normalizeProgressState(progressSnap.data() || {}, totalModules) : normalizeProgressState({}, totalModules);

        if (!state.completed) {
          return sendJson(res, 403, { error: "Course must be completed before exam submission" });
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

        await progressRef.set(
          {
            examPassed: passed,
            completed: passed || state.completed,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        return sendJson(res, 200, { passed, score, total, percentage });
      } catch (err) {
        logger.error("/api/exam/submit failed", err);
        return sendJson(res, 500, { error: "Server error" });
      }
    }

    if (method === "GET" && pathname === "/api/certificate/status") {
      const courseId = String(req.query.courseId || "").trim();
      if (!courseId) return sendJson(res, 400, { error: "courseId is required" });

      try {
        const course = findCourse(courseId);
        const totalModules = course && Array.isArray(course.modules) ? course.modules.length : 0;

        const progressRef = db.collection("users").doc(uid).collection("progress").doc(courseId);
        const progressSnap = await progressRef.get();
        const state = progressSnap.exists ? normalizeProgressState(progressSnap.data() || {}, totalModules) : normalizeProgressState({}, totalModules);

        const username = await resolveUsername(uid, decoded);

        return sendJson(res, 200, {
          examPassed: !!state.examPassed,
          certificateIssued: !!state.certificateIssued,
          username
        });
      } catch (err) {
        logger.error("/api/certificate/status failed", err);
        return sendJson(res, 500, { error: "Server error" });
      }
    }

    if (method === "POST" && pathname === "/api/certificate/issue") {
      let body;
      try {
        body = parseJsonBody(req);
      } catch (err) {
        return sendJson(res, 400, { error: "Invalid JSON" });
      }

      const courseId = String(body.courseId || "").trim();
      if (!courseId) return sendJson(res, 400, { error: "courseId is required" });

      const course = findCourse(courseId);
      const totalModules = course && Array.isArray(course.modules) ? course.modules.length : 0;

      try {
        const progressRef = db.collection("users").doc(uid).collection("progress").doc(courseId);
        const progressSnap = await progressRef.get();
        const state = progressSnap.exists ? normalizeProgressState(progressSnap.data() || {}, totalModules) : normalizeProgressState({}, totalModules);

        if (!state.examPassed) {
          return sendJson(res, 403, { error: "Exam must be passed before issuing certificate" });
        }

        await progressRef.set(
          {
            certificateIssued: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        return sendJson(res, 200, { ok: true });
      } catch (err) {
        logger.error("/api/certificate/issue failed", err);
        return sendJson(res, 500, { error: "Server error" });
      }
    }

    return sendJson(res, 404, { error: "Not found" });
  }
);
