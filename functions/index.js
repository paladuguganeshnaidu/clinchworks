const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.verifyUser = functions.https.onRequest(async (req, res) => {
    try {
        const token = req.headers.authorization?.split("Bearer ")[1];
        if (!token) return res.status(401).send("Unauthorized");
        const decoded = await admin.auth().verifyIdToken(token);
        return res.status(200).json({ uid: decoded.uid, email: decoded.email });
    } catch (err) {
        return res.status(401).send("Invalid token");
    }
});

exports.adminOnly = functions.https.onRequest(async (req, res) => {
     try {
        const token = req.headers.authorization?.split("Bearer ")[1];
        if (!token) return res.status(401).send("Unauthorized");
        
        const decoded = await admin.auth().verifyIdToken(token);
        const userDoc = await admin.firestore().collection('users').doc(decoded.uid).get();
        
        if (!userDoc.exists || userDoc.data().role !== 'admin') {
            return res.status(403).send("Forbidden: Admins only");
        }
        
        return res.status(200).send("Welcome Admin");
    } catch (err) {
        return res.status(401).send("Unauthorized");
    }
});

exports.getAllUsers = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    
    const callerRef = await admin.firestore().collection("users").doc(context.auth.uid).get();
    if (!callerRef.exists || callerRef.data().role !== "admin") {
        throw new functions.https.HttpsError("permission-denied", "Admin access required.");
    }

    const usersSnapshot = await admin.firestore().collection("users").get();
    return usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
});
