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
    runTransaction,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

window.addEventListener('pageshow', (event) => {
    if (event.persisted) window.location.reload();
});

setPersistence(auth, browserLocalPersistence).catch(() => { });

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?\d{7,15}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const PROFILE_REQUIRED_KEYS = ['firstName', 'lastName', 'phone', 'dob', 'gender', 'address', 'city', 'country'];
const ALLOWED_GENDERS = new Set(['male', 'female', 'other', 'prefer_not_to_say']);

const sanitizePlainText = (value, maxLen = 160) => {
    let text = typeof value === 'string' ? value : String(value || '');
    text = text.replace(/[\u0000-\u001F\u007F]/g, '');
    text = text.replace(/<\s*\/?\s*script\b[^>]*>/gi, '');
    text = text.replace(/javascript:/gi, '');
    text = text.replace(/<\/?[^>]+(>|$)/g, '');
    text = text.trim();
    if (text.length > maxLen) text = text.slice(0, maxLen);
    return text;
};

const sanitizeName = (value) => sanitizePlainText(value, 80);
const sanitizeEmail = (value) => sanitizePlainText(value, 254).toLowerCase();
const sanitizePhone = (value) => sanitizePlainText(value, 25).replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
const sanitizeAddress = (value) => sanitizePlainText(value, 240);
const sanitizeCityCountry = (value) => sanitizePlainText(value, 120);

const sanitizeDob = (value) => {
    const raw = sanitizePlainText(value, 10);
    if (!DATE_REGEX.test(raw)) return '';

    const parsed = new Date(`${raw}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) return '';

    const currentYear = new Date().getUTCFullYear();
    const year = Number(raw.slice(0, 4));
    if (year < 1900 || year > currentYear) return '';

    return raw;
};

const sanitizeGender = (value) => {
    const normalized = sanitizePlainText(value, 32).toLowerCase();
    return ALLOWED_GENDERS.has(normalized) ? normalized : '';
};

const formatProvider = (providerValue) => {
    const provider = String(providerValue || '').toLowerCase();
    if (provider === 'google') return 'Google';
    if (provider === 'email') return 'Email';
    return 'Unknown';
};

const formatDate = (value) => {
    if (!value) return 'N/A';

    let dateObj = null;
    if (typeof value.toDate === 'function') {
        dateObj = value.toDate();
    } else if (typeof value.seconds === 'number') {
        dateObj = new Date(value.seconds * 1000);
    } else {
        const parsed = new Date(value);
        dateObj = Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (!dateObj || Number.isNaN(dateObj.getTime())) return 'N/A';
    return dateObj.toLocaleString();
};

const getSessionFlag = (key) => {
    try {
        return sessionStorage.getItem(key);
    } catch (error) {
        return null;
    }
};

const setSessionFlag = (key, value) => {
    try {
        sessionStorage.setItem(key, value);
    } catch (error) { }
};

const clearSessionFlag = (key) => {
    try {
        sessionStorage.removeItem(key);
    } catch (error) { }
};

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
    let authSyncInFlight = false;

    const getEl = (id) => document.getElementById(id);
    const getInputValue = (id) => {
        const el = getEl(id);
        return el ? String(el.value || '').trim() : '';
    };

    const setInputValue = (id, value) => {
        const el = getEl(id);
        if (el) el.value = value || '';
    };

    const setText = (id, value) => {
        const el = getEl(id);
        if (el) el.textContent = value;
    };

    const showMsg = (msg, isError = true) => {
        if (!msgDiv) return;
        msgDiv.textContent = msg;
        msgDiv.style.color = isError ? '#dc2626' : '#059669';
        msgDiv.classList.remove('hidden');
    };

    const clearMsg = () => {
        if (!msgDiv) return;
        msgDiv.textContent = '';
        msgDiv.classList.add('hidden');
    };

    const setLoading = (btn, isLoading, originalText = 'Submit') => {
        if (!btn) return;
        btn.disabled = isLoading;
        btn.textContent = isLoading ? 'Loading...' : originalText;
        btn.style.opacity = isLoading ? '0.7' : '1';
        btn.style.cursor = isLoading ? 'not-allowed' : 'pointer';
    };

    const resolvePath = (target) => {
        if (target === 'index') return '/';
        if (target === 'login') return '/login';
        if (target === 'register') return '/register';
        if (target === 'profile') return '/profile';
        if (target === 'admin') return '/admin';
        return '/';
    };

    const protectedRouteNames = new Set([
        'admin',
        'reception',
        'profile',
        'dashboard',
        'domain',
        'course',
        'player',
        'exam'
    ]);

    const isProtectedRoute = (pathname) => {
        const normalized = String(pathname || '').toLowerCase().replace(/\/+$/, '');
        const segments = normalized.split('/').filter(Boolean);
        const lastSegment = (segments[segments.length - 1] || '').replace(/\.html$/, '');
        return protectedRouteNames.has(lastSegment);
    };

    const isSafeInternalRedirect = (path) => {
        if (!path || typeof path !== 'string') return false;
        if (!path.startsWith('/')) return false;
        if (path.startsWith('//')) return false;
        if (path.includes('\\')) return false;
        return true;
    };

    const resolveIntentRedirect = () => {
        const params = new URLSearchParams(window.location.search);
        const encodedRedirect = params.get('redirect');
        const defaultPath = resolvePath('index');

        if (!encodedRedirect) return defaultPath;

        try {
            const decoded = decodeURIComponent(encodedRedirect);
            const url = new URL(decoded, window.location.origin);
            if (url.origin !== window.location.origin) return defaultPath;
            if (!isSafeInternalRedirect(url.pathname)) return defaultPath;

            const lowerPath = url.pathname.toLowerCase();
            if (lowerPath.includes('/login') || lowerPath.includes('/register') || lowerPath.includes('/api/')) {
                return defaultPath;
            }

            return `${url.pathname}${url.search}${url.hash}`;
        } catch (error) {
            return defaultPath;
        }
    };

    const createNavUserMenu = () => {
        if (!btns.navAuth || !btns.navAuth.parentNode) return null;

        const trigger = btns.navAuth;
        const parent = trigger.parentNode;

        let wrapper = trigger.closest('.nav-user-menu');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'nav-user-menu hidden sm:flex';
            parent.insertBefore(wrapper, trigger);
            wrapper.appendChild(trigger);
        }

        trigger.removeAttribute('style');
        trigger.className = 'nav-user-trigger';
        trigger.setAttribute('href', '#');
        trigger.setAttribute('aria-haspopup', 'menu');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-label', 'User menu');

        let avatarIcon = trigger.querySelector('.nav-user-avatar-icon');
        if (!avatarIcon) {
            avatarIcon = document.createElement('span');
            avatarIcon.className = 'nav-user-avatar-icon';
            avatarIcon.setAttribute('aria-hidden', 'true');
            avatarIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 0 0-16 0"></path><circle cx="12" cy="8" r="4"></circle></svg>';
            trigger.appendChild(avatarIcon);
        }

        let avatarText = trigger.querySelector('.nav-user-avatar-text');
        if (!avatarText) {
            avatarText = document.createElement('span');
            avatarText.className = 'nav-user-avatar-text hidden';
            avatarText.setAttribute('aria-hidden', 'true');
            avatarText.textContent = 'U';
            trigger.appendChild(avatarText);
        }

        let dropdown = wrapper.querySelector('.nav-user-dropdown');
        let profileItem = null;
        let logoutItem = null;

        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = 'nav-user-dropdown';
            dropdown.setAttribute('role', 'menu');

            profileItem = document.createElement('a');
            profileItem.className = 'nav-user-item';
            profileItem.textContent = 'Profile';
            profileItem.setAttribute('role', 'menuitem');
            dropdown.appendChild(profileItem);

            logoutItem = document.createElement('button');
            logoutItem.type = 'button';
            logoutItem.className = 'nav-user-item';
            logoutItem.textContent = 'Log Out';
            logoutItem.setAttribute('role', 'menuitem');
            dropdown.appendChild(logoutItem);

            wrapper.appendChild(dropdown);
        } else {
            profileItem = dropdown.querySelector('a.nav-user-item');
            logoutItem = dropdown.querySelector('button.nav-user-item');
        }

        let closeTimer = null;
        const setOpen = (open) => {
            if (open) {
                if (closeTimer) clearTimeout(closeTimer);
                wrapper.classList.add('open');
                trigger.setAttribute('aria-expanded', 'true');
                return;
            }

            closeTimer = setTimeout(() => {
                wrapper.classList.remove('open');
                trigger.setAttribute('aria-expanded', 'false');
            }, 90);
        };

        wrapper.addEventListener('mouseenter', () => setOpen(true));
        wrapper.addEventListener('mouseleave', () => setOpen(false));

        trigger.addEventListener('click', (event) => {
            event.preventDefault();
            const isOpen = wrapper.classList.contains('open');
            setOpen(!isOpen);
        });

        trigger.addEventListener('focus', () => setOpen(true));
        wrapper.addEventListener('focusout', (event) => {
            if (!wrapper.contains(event.relatedTarget)) {
                setOpen(false);
            }
        });

        document.addEventListener('click', (event) => {
            if (!wrapper.contains(event.target)) {
                wrapper.classList.remove('open');
                trigger.setAttribute('aria-expanded', 'false');
            }
        });

        return {
            wrapper,
            trigger,
            avatarIcon,
            avatarText,
            profileItem,
            logoutItem
        };
    };

    const navMenu = createNavUserMenu();

    const toInitials = (firstName, lastName) => {
        const first = String(firstName || '').trim().charAt(0);
        const last = String(lastName || '').trim().charAt(0);
        const fallback = String(auth.currentUser?.email || '').trim().charAt(0);
        return `${first}${last || fallback || ''}`.toUpperCase() || 'CW';
    };

    const detectProviderFromUser = (user) => {
        return user.providerData.some((p) => p.providerId === 'google.com') ? 'google' : 'email';
    };

    const baseUserPayload = ({ firstName, lastName, email, phone, provider }) => ({
        firstName: sanitizeName(firstName),
        lastName: sanitizeName(lastName),
        email: sanitizeEmail(email),
        phone: sanitizePhone(phone),
        dob: '',
        gender: '',
        address: '',
        city: '',
        country: '',
        provider: provider === 'google' ? 'google' : 'email',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        profileComplete: false
    });

    const computeProfileComplete = (data) => {
        return PROFILE_REQUIRED_KEYS.every((key) => {
            const value = String(data[key] || '').trim();
            return value.length > 0;
        });
    };

    const buildMigrationPatch = (data, user) => {
        const patch = {};
        const normalized = { ...(data || {}) };

        const normalizeField = (field, sanitizer, fallback = '') => {
            if (typeof normalized[field] !== 'string') {
                const safeFallback = sanitizer(fallback);
                normalized[field] = safeFallback;
                patch[field] = safeFallback;
                return;
            }

            const sanitized = sanitizer(normalized[field]);
            if (sanitized !== normalized[field]) {
                normalized[field] = sanitized;
                patch[field] = sanitized;
            }
        };

        normalizeField('firstName', sanitizeName, user.displayName ? user.displayName.split(/\s+/)[0] : 'User');
        normalizeField('lastName', sanitizeName, user.displayName ? user.displayName.split(/\s+/).slice(1).join(' ') : '');
        normalizeField('phone', sanitizePhone, '');
        normalizeField('dob', sanitizeDob, '');
        normalizeField('gender', sanitizeGender, '');
        normalizeField('address', sanitizeAddress, '');
        normalizeField('city', sanitizeCityCountry, '');
        normalizeField('country', sanitizeCityCountry, '');

        if (typeof normalized.email !== 'string' || !normalized.email) {
            normalized.email = sanitizeEmail(user.email || '');
            patch.email = normalized.email;
        }

        const currentProvider = String(normalized.provider || '').toLowerCase();
        if (!currentProvider) {
            normalized.provider = detectProviderFromUser(user);
            patch.provider = normalized.provider;
        } else if (currentProvider === 'password') {
            normalized.provider = 'email';
            patch.provider = 'email';
        } else if (currentProvider !== 'google' && currentProvider !== 'email') {
            normalized.provider = detectProviderFromUser(user);
            patch.provider = normalized.provider;
        }

        if (!Object.prototype.hasOwnProperty.call(normalized, 'createdAt')) {
            patch.createdAt = serverTimestamp();
        }

        if (!Object.prototype.hasOwnProperty.call(normalized, 'lastLogin')) {
            patch.lastLogin = serverTimestamp();
        }

        if (typeof normalized.profileComplete !== 'boolean') {
            normalized.profileComplete = computeProfileComplete(normalized);
            patch.profileComplete = normalized.profileComplete;
        }

        return patch;
    };

    const ensureUserDoc = async (user, seedPayload) => {
        const userRef = doc(db, 'users', user.uid);
        const payload = seedPayload || baseUserPayload({
            firstName: user.displayName ? user.displayName.split(/\s+/)[0] : 'User',
            lastName: user.displayName ? user.displayName.split(/\s+/).slice(1).join(' ') : '',
            email: user.email || '',
            phone: '',
            provider: detectProviderFromUser(user)
        });

        try {
            await runTransaction(db, async (transaction) => {
                const snap = await transaction.get(userRef);
                if (!snap.exists()) {
                    transaction.set(userRef, payload);
                }
            });
        } catch (error) {
            const fallback = await getDoc(userRef);
            if (!fallback.exists()) throw error;
        }

        const currentSnap = await getDoc(userRef);
        if (!currentSnap.exists()) return currentSnap;

        const migrationPatch = buildMigrationPatch(currentSnap.data() || {}, user);
        if (Object.keys(migrationPatch).length > 0) {
            await setDoc(userRef, migrationPatch, { merge: true });
        }

        return getDoc(userRef);
    };

    const updateLastLoginOncePerSession = async (uid) => {
        const sessionKey = `cw-last-login:${uid}`;
        if (getSessionFlag(sessionKey) === '1') return;

        setSessionFlag(sessionKey, '1');
        try {
            await setDoc(doc(db, 'users', uid), { lastLogin: serverTimestamp() }, { merge: true });
        } catch (error) {
            clearSessionFlag(sessionKey);
            throw error;
        }
    };

    const getProfilePayloadFromForm = () => {
        const payload = {
            firstName: sanitizeName(getInputValue('profile-firstname')),
            lastName: sanitizeName(getInputValue('profile-lastname')),
            phone: sanitizePhone(getInputValue('profile-phone')),
            dob: sanitizeDob(getInputValue('profile-dob')),
            gender: sanitizeGender(getInputValue('profile-gender')),
            address: sanitizeAddress(getInputValue('profile-address')),
            city: sanitizeCityCountry(getInputValue('profile-city')),
            country: sanitizeCityCountry(getInputValue('profile-country'))
        };

        const missing = PROFILE_REQUIRED_KEYS.filter((key) => !payload[key]);
        if (missing.length > 0) {
            return { payload: null, error: 'Please complete all required profile fields.' };
        }

        if (!PHONE_REGEX.test(payload.phone)) {
            return { payload: null, error: 'Please enter a valid phone number.' };
        }

        payload.profileComplete = PROFILE_REQUIRED_KEYS.every((key) => Boolean(payload[key]));
        return { payload, error: null };
    };

    const hydrateProfileForm = (data, user) => {
        if (!forms.profile) return;

        setInputValue('profile-firstname', data.firstName || '');
        setInputValue('profile-lastname', data.lastName || '');
        setInputValue('profile-phone', data.phone || '');
        setInputValue('profile-email', user.email || data.email || '');
        setInputValue('profile-dob', data.dob || '');
        setInputValue('profile-gender', data.gender || '');
        setInputValue('profile-address', data.address || '');
        setInputValue('profile-city', data.city || '');
        setInputValue('profile-country', data.country || '');

        setText('profile-initials', toInitials(data.firstName, data.lastName));
        setText('info-provider', formatProvider(data.provider));
        setText('info-created', formatDate(data.createdAt || user.metadata?.creationTime));
        setText('info-lastlogin', formatDate(data.lastLogin || user.metadata?.lastSignInTime));

        if (btns.changePass && data.provider === 'google') {
            btns.changePass.style.display = 'none';
        }
    };

    const setNavStateForUser = (userData) => {
        if (!navMenu) return;

        const initials = toInitials(userData && userData.firstName, userData && userData.lastName);
        const firstLetter = (initials.charAt(0) || 'U').toUpperCase();

        navMenu.avatarText.textContent = firstLetter;
        navMenu.avatarText.classList.remove('hidden');
        navMenu.avatarIcon.classList.add('hidden');

        navMenu.profileItem.href = resolvePath('profile');
        navMenu.profileItem.textContent = 'Profile';

        navMenu.logoutItem.textContent = 'Log Out';
        navMenu.logoutItem.onclick = async (event) => {
            event.preventDefault();
            try {
                await signOut(auth);
            } finally {
                window.location.href = resolvePath('login');
            }
        };
    };

    const setNavStateForGuest = () => {
        if (!navMenu) return;

        const target = encodeURIComponent(window.location.pathname + window.location.search);
        const loginPath = `${resolvePath('login')}?redirect=${target}`;

        navMenu.avatarText.classList.add('hidden');
        navMenu.avatarIcon.classList.remove('hidden');

        navMenu.profileItem.href = loginPath;
        navMenu.profileItem.textContent = 'Profile';

        navMenu.logoutItem.textContent = 'Log Out';
        navMenu.logoutItem.onclick = (event) => {
            event.preventDefault();
            window.location.href = loginPath;
        };
    };

    if (forms.login) {
        forms.login.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (isSubmitting) return;

            clearMsg();
            const btn = document.getElementById('btn-login');
            const email = sanitizeEmail(getInputValue('login-email'));
            const password = getInputValue('login-password');

            if (!EMAIL_REGEX.test(email)) {
                showMsg('Please enter a valid email address.', true);
                return;
            }

            if (!password) {
                showMsg('Password is required.', true);
                return;
            }

            isSubmitting = true;
            setLoading(btn, true, 'Log In');

            try {
                const credential = await signInWithEmailAndPassword(auth, email, password);
                const isPasswordProvider = credential.user.providerData.some((p) => p.providerId === 'password');
                if (isPasswordProvider && !credential.user.emailVerified) {
                    await signOut(auth);
                    showMsg('Please verify your email before logging in.', true);
                    return;
                }
                window.location.href = resolveIntentRedirect();
            } catch (error) {
                const safeCode = String(error.code || '');
                const message = safeCode === 'auth/invalid-credential'
                    ? 'Invalid credentials.'
                    : 'Unable to log in. Please try again.';
                showMsg(message, true);
            } finally {
                setLoading(btn, false, 'Log In');
                isSubmitting = false;
            }
        });
    }

    if (forms.register) {
        forms.register.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (isSubmitting) return;

            clearMsg();

            const btn = document.getElementById('btn-register');
            const firstName = sanitizeName(getInputValue('reg-firstname'));
            const lastName = sanitizeName(getInputValue('reg-lastname'));
            const phone = sanitizePhone(getInputValue('reg-phone'));
            const email = sanitizeEmail(getInputValue('reg-email'));
            const password = getInputValue('reg-password');
            const confirmPassword = getInputValue('reg-confirm-password');

            if (!firstName || !lastName || !phone || !email || !password || !confirmPassword) {
                showMsg('Please fill in all required fields.', true);
                return;
            }

            if (!EMAIL_REGEX.test(email)) {
                showMsg('Please enter a valid email address.', true);
                return;
            }

            if (!PHONE_REGEX.test(phone)) {
                showMsg('Please enter a valid phone number.', true);
                return;
            }

            if (password.length < 8) {
                showMsg('Password must be at least 8 characters.', true);
                return;
            }

            if (password !== confirmPassword) {
                showMsg('Passwords do not match.', true);
                return;
            }

            isSubmitting = true;
            setLoading(btn, true, 'Create Account');

            try {
                const credential = await createUserWithEmailAndPassword(auth, email, password);
                const payload = baseUserPayload({
                    firstName,
                    lastName,
                    email,
                    phone,
                    provider: 'email'
                });

                await ensureUserDoc(credential.user, payload);
                await sendEmailVerification(credential.user);
                await signOut(auth);

                setInputValue('reg-password', '');
                setInputValue('reg-confirm-password', '');
                showMsg('Verification email sent. Please verify before login.', false);

                setTimeout(() => {
                    window.location.href = resolvePath('login');
                }, 1500);
            } catch (error) {
                const safeCode = String(error.code || '');
                const message = safeCode === 'auth/email-already-in-use'
                    ? 'This email is already registered.'
                    : 'Unable to register. Please try again.';
                showMsg(message, true);
            } finally {
                setLoading(btn, false, 'Create Account');
                isSubmitting = false;
            }
        });
    }

    if (btns.google) {
        btns.google.addEventListener('click', async () => {
            if (isSubmitting) return;

            clearMsg();
            isSubmitting = true;

            try {
                const result = await signInWithPopup(auth, new GoogleAuthProvider());
                const displayName = sanitizePlainText(result.user.displayName || 'User', 120);
                const nameParts = displayName.split(/\s+/).filter(Boolean);
                const firstName = sanitizeName(nameParts[0] || 'User');
                const lastName = sanitizeName(nameParts.slice(1).join(' '));

                await ensureUserDoc(result.user, baseUserPayload({
                    firstName,
                    lastName,
                    email: result.user.email || '',
                    phone: '',
                    provider: 'google'
                }));

                window.location.href = resolveIntentRedirect();
            } catch (error) {
                if (String(error.code || '') !== 'auth/popup-closed-by-user') {
                    showMsg('Google sign-in failed. Please try again.', true);
                }
            } finally {
                isSubmitting = false;
            }
        });
    }

    if (btns.forgot) {
        btns.forgot.addEventListener('click', async (event) => {
            event.preventDefault();
            if (isSubmitting) return;

            clearMsg();

            const email = sanitizeEmail(getInputValue('login-email'));
            if (!EMAIL_REGEX.test(email)) {
                showMsg('Enter your account email in the email field first.', true);
                return;
            }

            isSubmitting = true;
            try {
                await sendPasswordResetEmail(auth, email);
                showMsg('Password reset email sent.', false);
            } catch (error) {
                showMsg('Unable to send password reset email.', true);
            } finally {
                isSubmitting = false;
            }
        });
    }

    if (forms.profile) {
        forms.profile.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (isSubmitting) return;

            clearMsg();
            const user = auth.currentUser;
            if (!user) {
                showMsg('Session expired. Please log in again.', true);
                return;
            }

            const { payload, error } = getProfilePayloadFromForm();
            if (error) {
                showMsg(error, true);
                return;
            }

            const btn = document.getElementById('btn-profile');
            isSubmitting = true;
            setLoading(btn, true, 'Save Profile');

            try {
                await setDoc(doc(db, 'users', user.uid), payload, { merge: true });
                showMsg('Profile updated successfully.', false);
            } catch (error) {
                showMsg('Unable to update profile. Please try again.', true);
            } finally {
                setLoading(btn, false, 'Save Profile');
                isSubmitting = false;
            }
        });
    }

    if (btns.changePass) {
        btns.changePass.addEventListener('click', async (event) => {
            event.preventDefault();
            if (isSubmitting) return;

            const newPassword = String(prompt('Enter new password (minimum 8 characters)') || '');
            if (!newPassword || newPassword.length < 8) {
                showMsg('Password must be at least 8 characters.', true);
                return;
            }

            isSubmitting = true;
            try {
                await updatePassword(auth.currentUser, newPassword);
                showMsg('Password updated successfully.', false);
            } catch (error) {
                showMsg('Re-login required before changing password.', true);
            } finally {
                isSubmitting = false;
            }
        });
    }

    onAuthStateChanged(auth, async (user) => {
        if (authSyncInFlight) return;
        authSyncInFlight = true;

        const path = window.location.pathname.toLowerCase();
        const isAuthPage = path.includes('/login') || path.includes('/register');
        const isProtectedPage = isProtectedRoute(path);
        const isVerified = user && (user.emailVerified || user.providerData.some((p) => p.providerId !== 'password'));

        try {
            if (user && isVerified) {
                if (isAuthPage) {
                    window.location.href = resolveIntentRedirect();
                    return;
                }

                await ensureUserDoc(user);
                await updateLastLoginOncePerSession(user.uid);

                const refreshedSnap = await getDoc(doc(db, 'users', user.uid));
                const data = refreshedSnap.exists() ? (refreshedSnap.data() || {}) : {};
                hydrateProfileForm(data, user);
                setNavStateForUser(data);

                document.body.classList.remove('auth-cloak');
                document.body.classList.add('auth-resolved');
            } else {
                if (!isAuthPage && isProtectedPage) {
                    const target = encodeURIComponent(window.location.pathname + window.location.search);
                    window.location.href = `${resolvePath('login')}?redirect=${target}`;
                    return;
                }

                setNavStateForGuest();

                document.body.classList.remove('auth-cloak');
                document.body.classList.add('auth-resolved');
            }
        } catch (error) {
            console.error('Session synchronization failed:', error);
            if (!isAuthPage && isProtectedPage) {
                await signOut(auth).catch(() => { });
                window.location.href = resolvePath('login');
                return;
            }

            setNavStateForGuest();
            document.body.classList.remove('auth-cloak');
            document.body.classList.add('auth-resolved');
        } finally {
            authSyncInFlight = false;
        }
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}
