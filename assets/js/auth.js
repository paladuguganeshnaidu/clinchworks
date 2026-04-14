import { auth, db } from './firebase.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    sendEmailVerification,
    sendPasswordResetEmail,
    updatePassword,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import { 
    doc, 
    setDoc, 
    getDoc,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const profileForm = document.getElementById('profile-form');
    const changePassBtn = document.getElementById('change-password');
    const msgDiv = document.getElementById('auth-msg');
    const navAuthBtn = document.getElementById('nav-auth-btn');
    
    // Welcome banner location (Home Page)
    const heroSection = document.getElementById('hero'); 

    // ENSURE BULLETPROOF PERSISTENCE
    setPersistence(auth, browserLocalPersistence);

    function showMsg(msg, isError = true) {
        if (!msgDiv) return;
        msgDiv.innerText = msg;
        msgDiv.style.color = isError ? '#dc2626' : '#059669'; // Tailwind red-600 / emerald-600 
        msgDiv.classList.remove('hidden');
    }

    function setLoading(btn, isLoading, originalText) {
        if (!btn) return;
        btn.disabled = isLoading;
        btn.innerText = isLoading ? "Loading..." : originalText;
        if(isLoading) {
            btn.classList.add('opacity-70');
            btn.style.cursor = 'not-allowed';
        } else {
            btn.classList.remove('opacity-70');
            btn.style.cursor = 'pointer';
        }
    }

    // REGISTRATION FLOW
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const firstName = document.getElementById('reg-firstname').value.trim();
            const lastName = document.getElementById('reg-lastname').value.trim();
            const phone = document.getElementById('reg-phone').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value;
            const confirmPassword = document.getElementById('reg-confirm-password').value;
            const btn = document.getElementById('btn-register');

            if (!firstName || !lastName || !phone || !email || !password || !confirmPassword) {
                return showMsg("All fields are required.", true);
            }
            if (!/^\d+$/.test(phone)) {
                return showMsg("Phone number must be numeric.", true);
            }
            if (password.length < 6) {
                return showMsg("Password must be at least 6 characters.", true);
            }
            if (password !== confirmPassword) {
                return showMsg("Passwords do not match.", true);
            }

            setLoading(btn, true, "Create Account");
            try {
                // 1. Create User
                const userCred = await createUserWithEmailAndPassword(auth, email, password);
                
                // SEND EMAIL VERIFICATION
                await sendEmailVerification(userCred.user);

                // 2. Store extra user data
                const userDocRef = doc(db, 'users', userCred.user.uid);
                await setDoc(userDocRef, {
                    firstName,
                    lastName,
                    phone,
                    email: userCred.user.email,
                    role: "user",
                    createdAt: serverTimestamp()
                });
                
                // Very important: sign them out so they don't bypass verification in the session
                await signOut(auth);

                showMsg("Verification email sent. Please check your inbox.", false);
                setTimeout(() => window.location.href = 'login.html', 2000);
            } catch (error) {
                let errorMsg = error.message;
                if (error.code === 'auth/email-already-in-use') errorMsg = 'Email is already in use.';
                showMsg(errorMsg, true);
                setLoading(btn, false, "Create Account");
            }
        });
    }

    // LOGIN FLOW
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            const btn = document.getElementById('btn-login');

            if (!email || !password) return showMsg("Email and password are required.", true);

            setLoading(btn, true, "Log In");
            try {
                const userCred = await signInWithEmailAndPassword(auth, email, password);
                
                if (!userCred.user.emailVerified) {
                    showMsg("Please verify your email before logging in.", true);
                    await signOut(auth);
                    setLoading(btn, false, "Log In");
                    return;
                }

                showMsg("Login successful! Redirecting...", false);
                setTimeout(() => window.location.href = '../index.html', 1500);
            } catch (error) {
                let errorMsg = error.message;
                if (error.code === 'auth/invalid-credential') errorMsg = 'Invalid email or password.';
                showMsg(errorMsg, true);
                setLoading(btn, false, "Log In");
            }
        });
    }

    // FORGOT PASSWORD FLOW
    const forgotBtn = document.getElementById('forgot-password');
    if (forgotBtn) {
        forgotBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();

            if (!email) {
                return showMsg("Enter your email in the field first to reset.", true);
            }

            try {
                await sendPasswordResetEmail(auth, email);
                showMsg("Password reset email sent. Check your inbox.", false);
            } catch (err) {
                let errorMsg = err.message;
                if (err.code === 'auth/user-not-found') errorMsg = 'No user found with this email.';
                showMsg(errorMsg, true);
            }
        });
    }

    // GOOGLE LOGIN FLOW
    const googleBtn = document.getElementById('google-login');
    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            const provider = new GoogleAuthProvider();
            try {
                const result = await signInWithPopup(auth, provider);
                const user = result.user;

                // Save user if first time
                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);

                if (!userSnap.exists()) {
                    await setDoc(userRef, {
                        firstName: user.displayName?.split(' ')[0] || "User",
                        lastName: user.displayName?.split(' ')[1] || "",
                        email: user.email,
                        phone: "",
                        role: "user",
                        provider: "google",
                        createdAt: serverTimestamp()
                    });
                }
                
                showMsg("Google Login successful! Redirecting...", false);
                setTimeout(() => window.location.href = '../index.html', 1500);

            } catch (error) {
                let errorMsg = error.message;
                if (error.code === 'auth/popup-blocked') {
                    errorMsg = "Popup blocked. Please allow popups or try again.";
                } else if (error.code === 'auth/popup-closed-by-user') {
                    errorMsg = "Login cancelled. Please try again.";
                }
                showMsg(errorMsg, true);
            }
        });
    }

    // PROFILE EDIT FLOW
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            if (!user) return;
            
            const btn = document.getElementById('btn-profile');
            const firstName = document.getElementById('profile-firstname').value.trim();
            const lastName = document.getElementById('profile-lastname').value.trim();
            const phone = document.getElementById('profile-phone').value.trim();
            
            setLoading(btn, true, "Save Changes");
            try {
                await setDoc(doc(db, 'users', user.uid), {
                    firstName,
                    lastName,
                    phone
                }, { merge: true });
                showMsg("Profile updated successfully", false);
            } catch (err) {
                showMsg(err.message, true);
            }
            setLoading(btn, false, "Save Changes");
        });
    }

    // CHANGE PASSWORD FLOW
    if (changePassBtn) {
        changePassBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const newPass = prompt("Enter new password (min 6 chars)");
            if (!newPass || newPass.length < 6) return showMsg("Invalid password entry", true);

            try {
                await updatePassword(auth.currentUser, newPass);
                showMsg("Password updated successfully", false);
            } catch (err) {
                showMsg("Re-login required for security purposes. " + err.message, true);
            }
        });
    }

    // SESSION MANAGEMENT (GLOBAL REDIRECTOR)
    onAuthStateChanged(auth, async (user) => {
        const path = window.location.pathname.toLowerCase();
        const isLoginPage = path.includes("login");
        const isRegisterPage = path.includes("register");
        
        // Verification Check: Google users are auto-verified; Email users must be verified.
        const isVerified = user && (user.emailVerified || user.providerData.some(p => p.providerId !== 'password'));

        if (user && isVerified) {
            try {
                // REDIRECT AWAY FROM AUTH PAGES IF LOGGED IN
                if (isLoginPage || isRegisterPage) {
                    window.location.href = "../index.html";
                    return;
                }

                // ANALYTICS LOGGING
                await setDoc(doc(db, "logs", user.uid), {
                    lastLogin: serverTimestamp()
                }, { merge: true });

                const docRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(docRef);
                let firstName = user.email.split('@')[0];
                
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    if (data.firstName) firstName = data.firstName;
                    
                    if (profileForm) {
                        document.getElementById('profile-firstname').value = data.firstName || "";
                        document.getElementById('profile-lastname').value = data.lastName || "";
                        document.getElementById('profile-phone').value = data.phone || "";
                        document.getElementById('profile-email').value = user.email;
                    }

                    if (changePassBtn && (data.provider === "google" || user.providerData.some(p => p.providerId === 'google.com'))) {
                        changePassBtn.style.display = "none";
                    }
                }

                // Navbar update
                if (navAuthBtn) {
                    navAuthBtn.innerText = `Hi, ${firstName}`;
                    navAuthBtn.href = "#"; 
                    navAuthBtn.onclick = (e) => {
                        e.preventDefault();
                        if(confirm("Are you sure you want to log out?")) {
                            signOut(auth).then(() => {
                                window.location.href = window.location.pathname.includes('/pages/') ? "login.html" : "pages/login.html";
                            });
                        }
                    };
                }

                // Welcome message dynamically placed on Home Page
                if (heroSection) {
                    if (!document.getElementById('welcome-banner')) {
                        const welcomeBanner = document.createElement('div');
                        welcomeBanner.id = 'welcome-banner';
                        welcomeBanner.className = 'absolute top-24 left-1/2 transform -translate-x-1/2 z-40 bg-green-500/10 border border-green-500/20 text-green-400 px-6 py-2 rounded-full font-bold text-sm shadow-lg backdrop-blur-md transition-all';
                        welcomeBanner.innerHTML = `Welcome, ${firstName} ✨`;
                        heroSection.appendChild(welcomeBanner);
                    }
                }

            } catch (err) {
                console.error("Auth sync error:", err);
            }
        } else {
            // Unauthenticated OR Unverified: Block protected pages
            if (!isLoginPage && !isRegisterPage) {
                const loginPath = window.location.pathname.includes('/pages/') ? "login.html" : "pages/login.html";
                window.location.href = loginPath;
            }
        }
    });

});
