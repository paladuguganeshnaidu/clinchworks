function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const courseId = params.get('id');
  const safeCourseId = encodeURIComponent(String(courseId || ''));

  const titleEl = document.getElementById('exam-title');
  const form = document.getElementById('exam-form');
  const resultBox = document.getElementById('result-box');
  const btnSubmit = document.getElementById('btn-submit');
  const btnReturn = document.getElementById('btn-return');
  const infoText = titleEl ? titleEl.parentElement.querySelector('p') : null;

  function showBlockedState(title, message, linkText, href) {
    if (titleEl) titleEl.textContent = title;
    if (form) form.style.display = 'none';
    if (!infoText) return;

    infoText.innerHTML = '';
    infoText.appendChild(document.createTextNode(message));
    if (linkText && href) {
      infoText.appendChild(document.createElement('br'));
      infoText.appendChild(document.createElement('br'));
      const link = document.createElement('a');
      link.href = href;
      link.className = 'inline-block px-8 py-3 bg-[#F7C763] text-black font-bold rounded-lg';
      link.textContent = linkText;
      infoText.appendChild(link);
    }
  }

  if (!courseId) {
    showBlockedState('Invalid Course ID', 'Missing course identifier.');
    return;
  }

  let state;
  try {
    const stateResponse = await fetch(`/api/progress?courseId=${safeCourseId}`, { credentials: 'same-origin' });
    if (stateResponse.status === 401 || stateResponse.status === 403) {
      const target = encodeURIComponent(window.location.pathname + window.location.search);
      showBlockedState('Login Required', 'Please log in to access the exam.', 'Log In', `/login?redirect=${target}`);
      return;
    }
    if (stateResponse.ok) {
      const statePayload = await stateResponse.json();
      state = statePayload.state || {};
    } else {
      throw new Error("API failed");
    }
  } catch (err) {
    console.warn("Exam progress check failed, using local fallback:", err);
    const local = localStorage.getItem(`cw_progress_${courseId}`);
    state = local ? JSON.parse(local) : {};
  }

  if (!state.completed) {
    showBlockedState('Unauthorized Access', 'You must complete the course modules before accessing the exam.', 'Return to Course', `/player?id=${safeCourseId}`);
    return;
  }

  if (state.examPassed) {
    showBlockedState('Exam Already Passed', 'You have already proven your competency.', 'Go to Certificate', `/certificate?id=${safeCourseId}`);
    return;
  }

  let mcqs = [];
  let codingQs = [];
  let fullExam = null;

  try {
    const response = await fetch(`/api/exam/questions?courseId=${safeCourseId}`, { credentials: 'same-origin' });
    if (!response.ok) {
      throw new Error('API questions unavailable');
    }

    const examData = await response.json();
    mcqs = Array.isArray(examData.mcq) ? examData.mcq : [];
    codingQs = Array.isArray(examData.coding) ? examData.coding : [];
  } catch (err) {
    console.warn('Exam API unavailable, using local examquestions.json fallback:', err);
    try {
      const localResp = await fetch('/examquestions.json', { cache: 'no-store' });
      if (!localResp.ok) throw new Error('Missing examquestions.json');
      const all = await localResp.json();
      const record = all && all[courseId];
      if (!record) {
        showBlockedState('Exam Unavailable', 'No exam is currently available for this course.', 'Return to Course', `/player?id=${safeCourseId}`);
        return;
      }

      fullExam = record;
      mcqs = Array.isArray(record.mcq) ? record.mcq : [];
      codingQs = Array.isArray(record.coding) ? record.coding : [];
    } catch (fallbackErr) {
      console.error('Failed loading local exam fallback:', fallbackErr);
      showBlockedState('Failed to load exam data', 'Please try again shortly.');
      return;
    }
  }

  const container = document.getElementById('questions-container');
  if (container) container.innerHTML = '';

  const codingFieldMap = [];

  if (container) {
    mcqs.forEach((mcq, idx) => {
      const qDiv = document.createElement('div');
      let optionsHTML = '';
      const options = Array.isArray(mcq.options) ? mcq.options : [];

      options.forEach((opt, oIdx) => {
        optionsHTML += `
          <label class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors hover:bg-white/5" style="border-color: var(--border-color, rgba(255,255,255,0.05));">
            <input type="radio" name="mcq-${idx}" value="${oIdx}" class="w-4 h-4 text-accent bg-transparent border-[var(--border-color)] focus:ring-accent" required>
            <span class="text-sm font-medium" style="color: var(--text-secondary);">${escapeHtml(opt)}</span>
          </label>
        `;
      });

      qDiv.innerHTML = `
        <div>
          <h3 class="text-base font-bold mb-3" style="color: var(--text-primary);"><span class="opacity-50 mr-2">${idx + 1}.</span> ${escapeHtml(mcq.q || '')}</h3>
          <div class="space-y-2 pl-6 sm:pl-7">
            ${optionsHTML}
          </div>
        </div>
      `;
      container.appendChild(qDiv);
    });

    codingQs.forEach((cq, idx) => {
      const qDiv = document.createElement('div');
      const qNum = mcqs.length + idx + 1;
      const originalId = String(cq.id || `coding-${idx}`);
      const fieldId = originalId.replace(/[^a-zA-Z0-9_-]/g, '') || `coding_${idx}`;
      codingFieldMap.push({ originalId, fieldId });

      qDiv.innerHTML = `
        <div>
          <h3 class="text-base font-bold mb-3" style="color: var(--text-primary);"><span class="opacity-50 mr-2">${qNum}.</span> ${escapeHtml(cq.q || '')}</h3>
          <div class="pl-6 sm:pl-7">
            <textarea name="${fieldId}" rows="3" class="w-full p-4 rounded-xl border text-sm focus:outline-none focus:ring-1 transition-all resize-y" style="background: var(--bg-primary); border-color: var(--border-color, rgba(255,255,255,0.1)); color: var(--text-primary); outline-color: var(--accent);" placeholder="Type answer here..." required></textarea>
          </div>
        </div>
      `;
      container.appendChild(qDiv);
    });
  }

  let returnUrl = `/player?id=${safeCourseId}`;

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.style.opacity = '0.7';
      }

      const formData = new FormData(form);
      const payload = {
        courseId,
        answers: {
          mcq: mcqs.map((_, idx) => Number.parseInt(formData.get(`mcq-${idx}`), 10)),
          coding: {}
        }
      };

      codingFieldMap.forEach((entry) => {
        payload.answers.coding[entry.originalId] = String(formData.get(entry.fieldId) || '');
      });

      try {
        let result = null;
        try {
          const response = await fetch('/api/exam/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            result = await response.json();
          } else {
            throw new Error('Submission failed');
          }
        } catch (apiErr) {
          console.warn('Exam submit API unavailable, grading locally:', apiErr);
          const key = fullExam || (await (async () => {
            const localResp = await fetch('/examquestions.json', { cache: 'no-store' });
            if (!localResp.ok) return null;
            const all = await localResp.json();
            return all && all[courseId];
          })());

          if (!key) throw new Error('No local exam key available');

          const keyMcq = Array.isArray(key.mcq) ? key.mcq : [];
          const keyCoding = Array.isArray(key.coding) ? key.coding : [];
          const total = keyMcq.length + keyCoding.length;
          let scoreLocal = 0;

          const submittedMcq = (payload.answers && Array.isArray(payload.answers.mcq)) ? payload.answers.mcq : [];
          keyMcq.forEach((q, idx) => {
            const ans = Number.parseInt(submittedMcq[idx], 10);
            if (Number.isInteger(ans) && ans === Number.parseInt(q.ans, 10)) scoreLocal += 1;
          });

          const submittedCoding = (payload.answers && payload.answers.coding) ? payload.answers.coding : {};
          keyCoding.forEach((q) => {
            const rawAnswer = String(submittedCoding[q.id] || '');
            const hay = rawAnswer.toLowerCase();
            const keywords = Array.isArray(q.keywords) ? q.keywords : [];
            const needed = Math.max(1, Math.ceil(keywords.length * 0.4));
            let hits = 0;
            keywords.forEach((kw) => {
              const k = String(kw || '').toLowerCase();
              if (k && hay.includes(k)) hits += 1;
            });
            if (keywords.length === 0) {
              if (rawAnswer.trim().length > 0) scoreLocal += 1;
            } else if (hits >= needed) {
              scoreLocal += 1;
            }
          });

          const percentageLocal = total > 0 ? Math.round((scoreLocal / total) * 100) : 0;
          const passedLocal = percentageLocal >= 60;
          result = { score: scoreLocal, total, percentage: percentageLocal, passed: passedLocal };

          // Persist minimal progress state locally for compatibility with player/certificate flows.
          try {
            const progressKey = `cw_progress_${courseId}`;
            const existingRaw = localStorage.getItem(progressKey);
            const existing = existingRaw ? JSON.parse(existingRaw) : {};
            existing.examPassed = !!passedLocal;
            if (passedLocal) {
              existing.completed = true;
            }
            localStorage.setItem(progressKey, JSON.stringify(existing));
          } catch (storageErr) {
            console.warn('Unable to persist local progress:', storageErr);
          }
        }

        const score = Number.parseInt(result.score, 10) || 0;
        const totalQ = Number.parseInt(result.total, 10) || (mcqs.length + codingQs.length);
        const percentage = Number.parseInt(result.percentage, 10) || 0;
        const passed = !!result.passed;

        if (resultBox) {
          resultBox.classList.remove('hidden');
          if (passed) {
            // Backup pass status in localStorage
            localStorage.setItem(`cw_exam_passed_${courseId}`, "true");

            resultBox.style.backgroundColor = 'rgba(22, 163, 74, 0.1)';
            resultBox.style.borderColor = '#16a34a';
            resultBox.innerHTML = `
              <div style="color: #16a34a; font-size: 1.1rem; font-weight: bold; margin-bottom: 0.5rem;">Exam Passed ✅</div>
              You scored ${score}/${totalQ} (${percentage}%). Your certificate has been successfully unlocked.
            `;
            if (btnReturn) btnReturn.textContent = 'Download Certificate Now';
            returnUrl = `/certificate?id=${safeCourseId}`;
          } else {
            resultBox.style.backgroundColor = 'rgba(220, 38, 38, 0.1)';
            resultBox.style.borderColor = '#ef4444';
            resultBox.innerHTML = `
              <div style="color: #ef4444; font-size: 1.1rem; font-weight: bold; margin-bottom: 0.5rem;">Exam Failed ❌</div>
              You scored ${score}/${totalQ} (${percentage}%). A minimum of 60% is required to pass.
            `;
            if (btnReturn) btnReturn.textContent = 'Return to Course';
            if (btnSubmit) btnSubmit.textContent = 'Retake Exam';
            returnUrl = `/player?id=${safeCourseId}`;
          }
        }

        if (btnReturn) btnReturn.classList.remove('hidden');
        window.scrollTo({ top: resultBox ? resultBox.offsetTop - 100 : 0, behavior: 'smooth' });
      } catch (err) {
        if (resultBox) {
          resultBox.classList.remove('hidden');
          resultBox.style.backgroundColor = 'rgba(220, 38, 38, 0.1)';
          resultBox.style.borderColor = '#ef4444';
          resultBox.textContent = 'Submission failed. Please try again.';
        }
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.style.opacity = '1';
        }
      }
    });
  }

  if (btnReturn) {
    btnReturn.addEventListener('click', () => {
      window.location.href = returnUrl;
    });
  }
});
