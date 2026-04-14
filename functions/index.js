const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * verifyUser: Verifies the Firebase ID Token provided in the Authorization header.
 * Returns the decoded UID and Email.
 */
exports.verifyUser = functions.https.onRequest(async (req, res) => {
    // Basic CORS handling for the dev environment
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET, POST');
        res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.status(204).send('');
        return;
    }

    try {
        const token = req.headers.authorization?.split("Bearer ")[1];

        if (!token) {
            return res.status(401).send("Unauthorized: No token provided");
        }

        const decoded = await admin.auth().verifyIdToken(token);

        return res.status(200).json({
            uid: decoded.uid,
            email: decoded.email,
        });

    } catch (err) {
        console.error("Token verification error:", err);
        return res.status(401).send("Invalid token");
    }
});

/**
 * adminOnly: Verifies the user has a 'role: admin' flag in their Firestore document.
 */
exports.adminOnly = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET, POST');
        res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.status(204).send('');
        return;
    }

    try {
        const token = req.headers.authorization?.split("Bearer ")[1];
        if (!token) return res.status(401).send("Unauthorized");

        const decoded = await admin.auth().verifyIdToken(token);
        const userDoc = await admin.firestore().collection("users").doc(decoded.uid).get();

        if (!userDoc.exists() || userDoc.data().role !== "admin") {
            return res.status(403).send("Forbidden: Admin access required");
        }

        res.status(200).json({
            message: "Welcome Admin",
            uid: decoded.uid
        });

    } catch (err) {
        console.error("Admin check error:", err);
        res.status(401).send("Unauthorized");
    }
});
