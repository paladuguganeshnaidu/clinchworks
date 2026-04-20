import { auth } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";

let authReadyResolve;
const authReady = new Promise((resolve) => {
  authReadyResolve = resolve;
});

let authReadyResolved = false;
onAuthStateChanged(auth, () => {
  if (!authReadyResolved) {
    authReadyResolved = true;
    authReadyResolve();
  }
});

async function getIdTokenSafe() {
  try {
    await authReady;
    const user = auth.currentUser;
    if (!user) return '';
    return await user.getIdToken();
  } catch (err) {
    return '';
  }
}

function isSameOriginUrl(url) {
  try {
    const u = new URL(url, window.location.origin);
    return u.origin === window.location.origin;
  } catch (err) {
    return false;
  }
}

function isApiPath(url) {
  try {
    const u = new URL(url, window.location.origin);
    return u.origin === window.location.origin && u.pathname.startsWith('/api/');
  } catch (err) {
    return false;
  }
}

const nativeFetch = window.fetch.bind(window);

window.fetch = async (input, init) => {
  try {
    const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    if (!url || !isSameOriginUrl(url) || !isApiPath(url)) {
      return nativeFetch(input, init);
    }

    const token = await getIdTokenSafe();
    if (!token) {
      return nativeFetch(input, init);
    }

    if (input instanceof Request) {
      const headers = new Headers(input.headers);
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const patchedRequest = new Request(input, {
        headers
      });
      return nativeFetch(patchedRequest);
    }

    const headers = new Headers((init && init.headers) || undefined);
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const patchedInit = Object.assign({}, init || {}, { headers });
    return nativeFetch(input, patchedInit);
  } catch (err) {
    return nativeFetch(input, init);
  }
};
