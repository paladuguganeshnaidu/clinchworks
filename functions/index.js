const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();
const UID_REGEX = /^[A-Za-z0-9_-]{10,128}$/;

const sanitizeText = (value, maxLen = 240) => {
    let text = typeof value === "string" ? value : String(value ?? "");
    text = text.replace(/[\u0000-\u001F\u007F]/g, "");
    text = text.replace(/<\s*\/?\s*script\b[^>]*>/gi, "");
    text = text.replace(/javascript:/gi, "");
    text = text.replace(/<\/?[^>]+(>|$)/g, "");
    text = text.trim();
    if (text.length > maxLen) text = text.slice(0, maxLen);
    return text;
};

const normalizeProvider = (value) => {
    const provider = sanitizeText(value, 20).toLowerCase();
    if (provider === "google") return "google";
    if (provider === "email") return "email";
    return "email";
};

const toIso = (value) => {
    if (!value) return null;

    if (typeof value.toDate === "function") {
        const dateValue = value.toDate();
        return Number.isNaN(dateValue.getTime()) ? null : dateValue.toISOString();
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const toUserRecord = (uid, data) => {
    const firstName = sanitizeText(data.firstName || "", 80);
    const lastName = sanitizeText(data.lastName || "", 80);
    const email = sanitizeText(data.email || "", 254).toLowerCase();
    const phone = sanitizeText(data.phone || "", 25);
    const dob = sanitizeText(data.dob || "", 10);
    const gender = sanitizeText(data.gender || "", 32).toLowerCase();
    const address = sanitizeText(data.address || "", 240);
    const city = sanitizeText(data.city || "", 120);
    const country = sanitizeText(data.country || "", 120);
    const provider = normalizeProvider(data.provider || "email");
    const createdAt = toIso(data.createdAt);
    const lastLogin = toIso(data.lastLogin);
    const profileComplete = Boolean(data.profileComplete);
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || "N/A";

    return {
        uid,
        firstName,
        lastName,
        fullName,
        email,
        phone,
        dob,
        gender,
        address,
        city,
        country,
        provider,
        createdAt,
        lastLogin,
        profileComplete
    };
};

const assertUid = (value) => {
    const uid = sanitizeText(value, 128);
    if (!UID_REGEX.test(uid)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid user id.");
    }
    return uid;
};

const verifyIdTokenFromHeaderIfPresent = async (context) => {
    const header = context?.rawRequest?.headers?.authorization;
    if (typeof header !== "string" || !header.startsWith("Bearer ")) return;

    const token = header.slice(7).trim();
    if (!token) {
        throw new functions.https.HttpsError("unauthenticated", "Missing ID token.");
    }

    const decoded = await admin.auth().verifyIdToken(token, true);
    if (!context.auth || decoded.uid !== context.auth.uid) {
        throw new functions.https.HttpsError("permission-denied", "Token mismatch.");
    }
};

const assertAdmin = async (context) => {
    if (!context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }

    await verifyIdTokenFromHeaderIfPresent(context);
    await admin.auth().getUser(context.auth.uid);

    const callerSnap = await db.collection("users").doc(context.auth.uid).get();
    if (!callerSnap.exists || callerSnap.get("role") !== "admin") {
        throw new functions.https.HttpsError("permission-denied", "Admin access required.");
    }

    return context.auth.uid;
};

exports.getAllUsers = functions.https.onCall(async (data, context) => {
    await assertAdmin(context);

    const search = sanitizeText(data && data.search ? data.search : "", 120).toLowerCase();
    const snapshot = await db.collection("users").get();

    const users = snapshot.docs.map((snap) => toUserRecord(snap.id, snap.data() || {}));

    const filtered = search
        ? users.filter((user) => {
            const haystack = `${user.fullName} ${user.email} ${user.phone} ${user.city} ${user.country}`.toLowerCase();
            return haystack.includes(search);
        })
        : users;

    filtered.sort((a, b) => {
        const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
        const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
        return bTime - aTime;
    });

    return {
        total: filtered.length,
        users: filtered.map((user) => ({
            uid: user.uid,
            name: user.fullName,
            email: user.email,
            phone: user.phone,
            profileComplete: user.profileComplete,
            provider: user.provider,
            lastLogin: user.lastLogin
        }))
    };
});

exports.getUserDetails = functions.https.onCall(async (data, context) => {
    await assertAdmin(context);

    const uid = assertUid(data && data.uid ? data.uid : "");
    const userSnap = await db.collection("users").doc(uid).get();

    if (!userSnap.exists) {
        throw new functions.https.HttpsError("not-found", "User not found.");
    }

    return {
        user: toUserRecord(uid, userSnap.data() || {})
    };
});
