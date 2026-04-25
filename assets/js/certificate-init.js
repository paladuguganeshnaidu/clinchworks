import { auth, db } from './firebase.js';
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

function getUid() {
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, user => {
      unsub();
      resolve(user ? user.uid : null);
    });
  });
}
async function fetchJson(url, options) {
    const response = await fetch(url, Object.assign({ credentials: "same-origin" }, options || {}));
    let payload = null;
    try {
        payload = await response.json();
    } catch (err) {
        payload = null;
    }
    return { response, payload };
}

function setButtonIssuedState(btn) {
    btn.textContent = "Certificate already issued";
    btn.style.pointerEvents = "none";
    btn.style.opacity = "0.5";
}

document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('id');
    const safeCourseId = encodeURIComponent(String(courseId || ''));

    const recipientNameEl = document.querySelector('.recipient-name');
    const courseNameEl = document.querySelector('.course-name');
    const levelBadgeEl = document.querySelector('.level-badge');
    const btn = document.getElementById('download-btn');

    let certificateAlreadyIssued = false;
    let resolvedName = "ClinchWorks Student";

    if (courseId) {
        try {
            
            const uid = await getUid();
            if (!uid) { window.location.href = '/login'; return; }
            const ref = doc(db, 'courses', uid);
            const snap = await getDoc(ref);
            if (!snap.exists()) throw new Error("No user");
            const data = snap.data();
            const state = (data.courses || {})[courseId] || {};
            
            if (!state.examPassed) {
                await showModal("Final Exam Required", "You have not passed the final exam yet.", { type: "warning", confirmText: "Go to Exam" });
                window.location.href = `/exam?id=${safeCourseId}`;
                return;
            }
            if (data.firstName || data.lastName) {
                resolvedName = [data.firstName, data.lastName].filter(Boolean).join(' ');
            }
            const certIdEl = document.getElementById('cert-id');
            if (state.certificateId && certIdEl) {
                certIdEl.textContent = `ID: ${state.certificateId}`;
            }
            certificateAlreadyIssued = !!state.certificateIssued;

        } catch (err) {
            console.warn("Certificate API failed, checking local fallback:", err);
            const localPass = localStorage.getItem(`cw_exam_passed_${courseId}`);
            if (localPass !== "true") {
                await showModal("Verification Failed", "Unable to verify exam status. Please ensure you have passed the exam on this device.", {
                    type: "error",
                    confirmText: "Go to Exam"
                });
                window.location.href = `/exam?id=${safeCourseId}`;
                return;
            }
            const localName = localStorage.getItem(`cw_name_${courseId}`);
            if (localName) {
                resolvedName = localName;
            }
        }

        if (certificateAlreadyIssued) {
            setButtonIssuedState(btn);
        }
    }

    if (resolvedName === "ClinchWorks Student") {
        
        }
    }

    if (recipientNameEl) recipientNameEl.textContent = resolvedName;

    if (courseId) {
        try {
            const response = await fetch('/courses-content.json');
            const data = await response.json();
            const cd = data.courses.find(c => c.id === courseId);
            if (cd) {
                if (courseNameEl) courseNameEl.textContent = cd.title;
                if (levelBadgeEl) levelBadgeEl.textContent = `${cd.category.toUpperCase()} | ${cd.level.toUpperCase()}`;
            }
        } catch (err) {
            console.error("Failed fetching certificate metadata");
        }
    }

    const dOpts = { year: 'numeric', month: 'long', day: 'numeric' };
    const certDateEl = document.getElementById('cert-date');
    if (certDateEl) certDateEl.textContent = new Date().toLocaleDateString('en-US', dOpts);

    if (btn) {
        btn.addEventListener('mouseenter', () => btn.style.transform = 'translateY(-2px)');
        btn.addEventListener('mouseleave', () => btn.style.transform = 'translateY(0)');

        btn.addEventListener('click', () => {
            if (certificateAlreadyIssued) {
                return;
            }

            const btnArea = document.querySelector('.no-print');
            if (btnArea) btnArea.style.display = 'none';

            const element = document.querySelector('.certificate-container');
            const opt = {
                margin: 0.5,
                filename: `ClinchWorks_Certificate_${courseId || 'Certified'}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
            };

            html2pdf().set(opt).from(element).save().then(async () => {
                if (btnArea) btnArea.style.display = 'block';

                if (courseId) {
                    try {
                        
                        const uid = await getUid();
                        const newCertId = 'CW-' + Math.random().toString(36).substr(2, 6).toUpperCase();
                        await setDoc(doc(db, 'courses', uid), {
                            courses: {
                                [courseId]: {
                                    certificateIssued: true,
                                    certificateId: newCertId,
                                    updatedAt: serverTimestamp()
                                }
                            }
                        }, { merge: true });
                        certificateAlreadyIssued = true;
                        const certIdEl = document.getElementById('cert-id');
                        if (certIdEl) certIdEl.textContent = `ID: ${newCertId}`;
                        setButtonIssuedState(btn);
                        return; catch (err) {
                        console.warn('Certificate issue API unavailable, storing local issued state:', err);

                        try {
                            const key = `cw_progress_${courseId}`;
                            const raw = localStorage.getItem(key);
                            const state = raw ? JSON.parse(raw) : {};
                            state.certificateIssued = true;
                            localStorage.setItem(key, JSON.stringify(state));
                        } catch (storageErr) {
                            console.warn('Unable to persist local certificateIssued flag:', storageErr);
                        }

                        certificateAlreadyIssued = true;
                        setButtonIssuedState(btn);
                    }
                }
            }).catch(() => {
                if (btnArea) btnArea.style.display = 'block';
            });
        });
    }
});
