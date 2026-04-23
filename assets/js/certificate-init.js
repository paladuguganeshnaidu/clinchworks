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
            const statusResult = await fetchJson(`/api/certificate/status?courseId=${safeCourseId}`);
            if (statusResult.response.ok && statusResult.payload) {
                if (!statusResult.payload.examPassed) {
                    await showModal("Final Exam Required", "You have not passed the final exam yet.", {
                        type: "warning",
                        confirmText: "Go to Exam"
                    });
                    window.location.href = `/exam?id=${safeCourseId}`;
                    return;
                }

                if (statusResult.payload.username && String(statusResult.payload.username).trim()) {
                    resolvedName = String(statusResult.payload.username).trim();
                }

                certificateAlreadyIssued = !!statusResult.payload.certificateIssued;
            } else {
                throw new Error("API failed");
            }
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
        const sessionResult = await fetchJson('/api/session');
        if (sessionResult.response.ok && sessionResult.payload && sessionResult.payload.username) {
            const candidate = String(sessionResult.payload.username).trim();
            if (candidate) {
                resolvedName = candidate;
            }
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
                        const issueResult = await fetchJson('/api/certificate/issue', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ courseId })
                        });

                        if (issueResult.response.ok) {
                            certificateAlreadyIssued = true;
                            setButtonIssuedState(btn);
                            return;
                        }
                        throw new Error('API issue failed');
                    } catch (err) {
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
