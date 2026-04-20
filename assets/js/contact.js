import { db } from './firebase.js';
import {
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const sanitizePlainText = (value, maxLen = 500) => {
  let text = typeof value === 'string' ? value : String(value || '');
  text = text.replace(/[\u0000-\u001F\u007F]/g, '');
  text = text.replace(/<\s*\/?\s*script\b[^>]*>/gi, '');
  text = text.replace(/javascript:/gi, '');
  text = text.replace(/<\/?[^>]+(>|$)/g, '');
  text = text.trim();
  if (text.length > maxLen) text = text.slice(0, maxLen);
  return text;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

(function initContactForm() {
  const form = document.getElementById('contact-form');
  const submitBtn = document.getElementById('contact-submit');
  const msg = document.getElementById('contact-msg');

  if (!form || !submitBtn || !msg) return;

  const showMsg = (text, isError) => {
    msg.textContent = text;
    msg.classList.remove('hidden');
    msg.style.borderColor = isError ? 'rgba(220, 38, 38, 0.45)' : 'rgba(247, 199, 99, 0.45)';
    msg.style.background = isError ? 'rgba(220, 38, 38, 0.1)' : 'rgba(247, 199, 99, 0.12)';
    msg.style.color = isError ? '#b91c1c' : '#0b1220';
  };

  const setLoading = (loading) => {
    submitBtn.disabled = loading;
    submitBtn.style.opacity = loading ? '0.75' : '1';
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    msg.classList.add('hidden');
    setLoading(true);

    const payload = {
      name: sanitizePlainText(document.getElementById('name')?.value || '', 120),
      email: sanitizePlainText(document.getElementById('email')?.value || '', 254).toLowerCase(),
      service: sanitizePlainText(document.getElementById('service')?.value || 'general', 80).toLowerCase(),
      details: sanitizePlainText(document.getElementById('details')?.value || '', 1200)
    };

    if (!payload.name || !payload.email || !payload.details) {
      showMsg('Please fill in your name, email, and details.', true);
      setLoading(false);
      return;
    }

    if (!EMAIL_REGEX.test(payload.email)) {
      showMsg('Please enter a valid email address.', true);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        form.reset();
        showMsg('Thank you. Your request has been submitted successfully.', false);
        return;
      }

      throw new Error(data.error || 'Contact API not available');
    } catch (apiErr) {
      console.warn('Contact API failed; falling back to Firestore:', apiErr);
    }

    try {
      await addDoc(collection(db, 'contactMessages'), {
        name: payload.name,
        email: payload.email,
        service: payload.service,
        details: payload.details,
        status: 'new',
        createdAt: serverTimestamp(),
        page: sanitizePlainText(window.location.pathname || '', 200)
      });

      form.reset();
      showMsg('Thank you. Your request has been submitted successfully.', false);
    } catch (fireErr) {
      console.error('Firestore contact fallback failed:', fireErr);
      showMsg('Unable to submit request right now. Please try again.', true);
    } finally {
      setLoading(false);
    }
  });
})();
