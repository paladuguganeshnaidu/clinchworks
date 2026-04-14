import { auth, db } from './firebase.js';
import { 
    createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, 
    onAuthStateChanged, GoogleAuthProvider, signInWithPopup, 
    sendEmailVerification, sendPasswordResetEmail, updatePassword, setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

window.addEventListener("pageshow", (event) => {
    if (event.persisted) window.location.reload();
});

setPersistence(auth, browserLocalPersistence);

const initAuth = () => {
    const forms = {
        login: document.getElementById('login-form'),
        register: document.getElementById('register-form'),
        profile: document.getElementById('profile-form')
    };
    const btns = {
        google: document.getElementById('google-login'),
        forgot: document.getElementById('forgot-password'),
        changePass: document.getElementById('change-password'),
        navAuth: document.getElementById('nav-auth-btn')
    };
    const msgDiv = document.getElementById('auth-msg');
    let isSubmitting = false;

    const sanitizeInput = (str) => {
        if (typeof str !== 'string') return '';
        return str.replace(/[<>"'&]/g, (match) => {
            return {'<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;'}[match];
        });
    };

    const showMsg = (msg, isError = true) => {
        if (!msgDiv) return;
        msgDiv.textContent = msg; 
        msgDiv.style.color = isError ? '#dc2626' : '#059669';
        msgDiv.classList.remove('hidden');
    };

    const setLoading = (btn, isLoading, originalText = "Submit") => {
        if (!btn) return;
        btn.disabled = isLoading;
        btn.textContent = isLoading ? "Loading..." : originalText;
        btn.style.opacity = isLoading ? "0.7" : "1";
        btn.style.cursor = isLoading ? "not-allowed" : "pointer";
    };

    const resolvePath = (target) => {
        const isRoot = !window.location.pathname.includes('/pages/');
        if (target === 'index') return isRoot ? 'index.html' : '../index.html';
        if (target === 'login') return isRoot ? 'pages/login.html' : 'login.html';
    };

    const resolveIntentRedirect = () => {
        const params = new URLSearchParams(window.location.search);
        let redirect = params.get('redirect');
        
        if (redirect) {
            try {
                const url = new URL(decodeURIComponent(redirect), window.location.origin);
                if (url.origin === window.location.origin && (url.protocol === 'http:' || url.protocol === 'https:')) {
                    return url.pathname + url.search + url.hash;
                }
            } catch (e) {
                console.warn("Blocked malicious redirect payload");
            }
        }
        return resolvePath('index');
    };

    if (forms.login) {
        forms.login.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (isSubmitting) return;
            isSubmitting = true;
            const btn = document.getElementById('btn-login');
            setLoading(btn, true, "Log In");
            try {
                const email = document.getElementById('login-email').value.trim();
                const pass = document.getElementById('login-password').value;
                const cred = await signInWithEmailAndPassword(auth, email, pass);
                if (!cred.user.emailVerified) {
                    showMsg("Please verify your email before logging in.", true);
                    await signOut(auth);
                } else {
                    window.location.href = resolveIntentRedirect();
                    return;
                }
            } catch (err) {
                showMsg(err.code === 'auth/invalid-credential' ? 'Invalid credentials.' : err.message, true);
            } finally {
                setLoading(btn, false, "Log In");
                isSubmitting = false;
            }
        });
    }

    if (forms.register) {
        forms.register.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (isSubmitting) return;
            isSubmitting = true;
            const fields = ['firstname', 'lastname', 'phone', 'email', 'password', 'confirm-password'].map(id => document.getElementById(`reg-${id}`).value.trim());
            const [first, last, phone, email, pass, confirm] = fields;
            const btn = document.getElementById('btn-register');

            if (fields.includes("") || pass !== confirm) {
                isSubmitting = false;
                return showMsg("Check empty fields or mismatch.", true);
            }
            
            setLoading(btn, true, "Create Account");
            try {
                const cred = await createUserWithEmailAndPassword(auth, email, pass);
                await sendEmailVerification(cred.user);
                await setDoc(doc(db, 'users', cred.user.uid), {
                    firstName: sanitizeInput(first), 
                    lastName: sanitizeInput(last), 
                    phone: sanitizeInput(phone), 
                    email: sanitizeInput(email),
                    createdAt: serverTimestamp() 
                });
                await signOut(auth);
                showMsg("Verification email sent.", false);
                document.getElementById('reg-password').value = '';
                document.getElementById('reg-confirm-password').value = '';
                setTimeout(() => window.location.href = resolvePath('login'), 2000);
            } catch (err) {
                showMsg(err.message, true);
            } finally {
                setLoading(btn, false, "Create Account");
                isSubmitting = false;
            }
        });
    }

    if (btns.google) {
        btns.google.addEventListener('click', async () => {
            if (isSubmitting) return;
            isSubmitting = true;
            try {
                const res = await signInWithPopup(auth, new GoogleAuthProvider());
                const userRef = doc(db, 'users', res.user.uid);
                const snap = await getDoc(userRef);
                if (!snap.exists()) {
                    const nameParts = res.user.displayName ? res.user.displayName.trim().split(/\s+/) : ["User"];
                    const first = nameParts[0];
                    const last = nameParts.length > 1 ? nameParts.slice(1).join(' ') : "";
                    
                    await setDoc(userRef, {
                        firstName: sanitizeInput(first),
                        lastName: sanitizeInput(last),
                        email: sanitizeInput(res.user.email), 
                        phone: "", 
                        provider: "google", 
                        createdAt: serverTimestamp()
                    });
                }
                window.location.href = resolveIntentRedirect();
            } catch (err) {
                if (err.code !== 'auth/popup-closed-by-user') showMsg(err.message, true);
            } finally {
                isSubmitting = false;
            }
        });
    }

    if (btns.forgot) {
        btns.forgot.addEventListener('click', async (e) => {
            e.preventDefault();
            if (isSubmitting) return;
            isSubmitting = true;
            const email = document.getElementById('login-email').value.trim();
            if (!email) {
                isSubmitting = false;
                return showMsg("Enter your email in the field first.", true);
            }
            try {
                await sendPasswordResetEmail(auth, email);
                showMsg("Reset email sent.", false);
            } catch (err) {
                showMsg(err.code === 'auth/user-not-found' ? 'No user found' : err.message, true);
            } finally {
                isSubmitting = false;
            }
        });
    }

    if (forms.profile) {
        forms.profile.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (isSubmitting) return;
            isSubmitting = true;
            const user = auth.currentUser;
            if (!user) { isSubmitting = false; return; }
            const btn = document.getElementById('btn-profile');
            setLoading(btn, true, "Save Changes");
            try {
                await setDoc(doc(db, 'users', user.uid), {
                    firstName: sanitizeInput(document.getElementById('profile-firstname').value.trim()),
                    lastName: sanitizeInput(document.getElementById('profile-lastname').value.trim()),
                    phone: sanitizeInput(document.getElementById('profile-phone').value.trim())
                }, { merge: true });
                showMsg("Profile updated successfully", false);
            } catch (err) { showMsg(err.message, true); }
            finally { setLoading(btn, false, "Save Changes"); isSubmitting = false; }
        });
    }

    if (btns.changePass) {
        btns.changePass.addEventListener('click', async (e) => {
            e.preventDefault();
            if (isSubmitting) return;
            isSubmitting = true;
            const newPass = prompt("Enter new password (min 6 chars)");
            if (!newPass || newPass.length < 6) {
                isSubmitting = false;
                return showMsg("Invalid password entry", true);
            }
            try {
                await updatePassword(auth.currentUser, newPass);
                showMsg("Password updated successfully", false);
            } catch (err) { showMsg("Re-login required. " + err.message, true); }
            finally { isSubmitting = false; }
        });
    }
    
    onAuthStateChanged(auth, async (user) => {
        const path = window.location.pathname.toLowerCase();
        const isAuthPage = path.includes("login") || path.includes("register");
        const isVerified = user && (user.emailVerified || user.providerData.some(p => p.providerId !== 'password'));

        if (user && isVerified) {
            if (isAuthPage) {
                window.location.href = resolveIntentRedirect();
                return;
            }

            try {
                await setDoc(doc(db, "logs", user.uid), { lastLogin: serverTimestamp() }, { merge: true });
                const snap = await getDoc(doc(db, 'users', user.uid));
                let firstName = user.email.split('@')[0];
                
                if (snap.exists()) {
                    const data = snap.data();
                    if (data.firstName) firstName = data.firstName;
                    if (forms.profile) {
                        document.getElementById('profile-firstname').value = data.firstName || "";
                        document.getElementById('profile-lastname').value = data.lastName || "";
                        document.getElementById('profile-phone').value = data.phone || "";
                        document.getElementById('profile-email').value = user.email;
                    }
                    if (btns.changePass && (data.provider === "google" || user.providerData.some(p => p.providerId === 'google.com'))) {
                        btns.changePass.style.display = "none";
                    }
                }

                if (btns.navAuth) {
                    btns.navAuth.textContent = "Profile";
                    btns.navAuth.href = `${resolvePath('index').replace('index.html', '')}pages/profile.html`;
                    btns.navAuth.onclick = null;
                    
                    if (!document.getElementById('inject-logout')) {
                        const logoutBtn = document.createElement('a');
                        logoutBtn.id = 'inject-logout';
                        logoutBtn.href = "#";
                        logoutBtn.textContent = "Log Out";
                        logoutBtn.className = "hidden sm:block text-xs sm:text-sm font-bold ml-2 hover:underline";
                        logoutBtn.style.color = "#F7C763";
                        logoutBtn.onclick = (e) => { e.preventDefault(); signOut(auth).then(() => window.location.href = resolvePath('login')); };
                        btns.navAuth.parentNode.appendChild(logoutBtn);
                    }
                }

                const hero = document.getElementById('hero');
                if (hero && !document.getElementById('welcome-banner')) {
                    const banner = document.createElement('div');
                    banner.id = 'welcome-banner';
                    banner.className = 'absolute top-24 left-1/2 transform -translate-x-1/2 z-40 bg-green-500/10 border border-green-500/20 text-green-400 px-6 py-2 rounded-full font-bold text-sm shadow-lg backdrop-blur-md transition-all';
                    banner.textContent = `Welcome, ${firstName} ✨`;
                    hero.appendChild(banner);
                }

                document.body.classList.remove('auth-cloak');
                document.body.classList.add('auth-resolved');

            } catch (err) {
                console.error("Session desync:", err);
            }
        } else {
            if (!isAuthPage) {
                const target = encodeURIComponent(window.location.pathname + window.location.search);
                window.location.href = `${resolvePath('login')}?redirect=${target}`;
            } else {
                document.body.classList.remove('auth-cloak');
                document.body.classList.add('auth-resolved');
            }
        }
    });
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuth);
} else {
    initAuth();
}
