import { auth, db } from '/assets/js/firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentCourseId = null;
let globalUser = null;
let globalUserData = null;

onAuthStateChanged(auth, async (user) => {
  globalUser = user;
  if (user) {
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        globalUserData = snap.data();
      }
    } catch (err) { }
  }
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function startSecureSession(courseId, name) {
  const response = await fetch("/api/session/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ courseId, name })
  });

  if (!response.ok) {
    throw new Error("Failed to initialize secure session");
  }
}

window.addEventListener('pageshow', (event) => {
  const btn = document.getElementById("btn-start");
  if (btn && btn.style.pointerEvents === 'none') {
    btn.style.pointerEvents = "auto";
    btn.style.opacity = "1";
    btn.innerHTML = 'Start Official Training <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>';
  }
});

window.attemptStartCourse = async (courseId) => {
  if (!globalUser) {
    const targetUrl = encodeURIComponent(window.location.pathname + window.location.search);
    await showModal("Login Required", "Please log in to access courses.", {
      type: "warning",
      confirmText: "Continue"
    });
    window.location.href = `/login?redirect=${targetUrl}`;
    return;
  }

  const btn = document.getElementById("btn-start");
  if (btn) {
    btn.style.pointerEvents = "none";
    btn.style.opacity = "0.7";
    btn.innerHTML = 'Starting... <svg class="w-5 h-5 animate-spin inline ml-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
  }

  let fullName = "Student";
  if (globalUserData && globalUserData.firstName) {
    fullName = globalUserData.firstName + " " + (globalUserData.lastName || "");
    fullName = fullName.trim();
  } else if (globalUser.email) {
    fullName = globalUser.email.split('@')[0];
  }

  try {
    await startSecureSession(courseId, fullName);
    window.location.href = `/player?id=${encodeURIComponent(courseId)}`;
  } catch (err) {
    console.warn("Secure session failed, falling back to local state:", err);
    localStorage.setItem(`cw_name_${courseId}`, fullName);
    window.location.href = `/player?id=${encodeURIComponent(courseId)}`;
  }
};

(async function () {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    document.getElementById("course-title").textContent = "Registry Fault.";
    return;
  }

  try {
    const response = await fetch("/courses-content.json");
    const data = await response.json();
    const courseData = data.courses.find((c) => c.id === id);

    if (!courseData) {
      document.getElementById("course-title").textContent = "Registry Fault.";
      return;
    }

    document.getElementById("course-title").textContent = courseData.title;
    document.getElementById("course-desc").textContent = courseData.description;
    document.getElementById("course-level").textContent = courseData.level;
    document.getElementById("course-duration").textContent = courseData.duration;
    document.getElementById("module-count").textContent = `${courseData.modules.length} Modules`;
    document.getElementById("btn-start").href = "#";
    document.getElementById("btn-start").onclick = (event) => {
      event.preventDefault();
      window.attemptStartCourse(courseData.id);
    };

    const list = document.getElementById("module-list");
    list.innerHTML = "";

    courseData.modules.forEach((mod, idx) => {
      const lessonCount = Array.isArray(mod.videos) ? mod.videos.length : 0;
      const card = document.createElement("div");
      card.className = "module-card sm:hover:scale-[1.03] transition-transform duration-300 transform";
      card.innerHTML = `
          <div class="flex items-center gap-6">
             <div class="w-14 h-14 bg-white text-black border border-slate-200 flex items-center justify-center rounded-2xl font-black text-xl">
                ${idx + 1}
             </div>
             <div class="flex-1">
                <h4 class="font-black text-slate-900 uppercase tracking-tight text-lg mb-1">${escapeHtml(mod.title)}</h4>
                <p class="text-slate-800 text-[10px] font-bold uppercase tracking-widest">${lessonCount} Interactive Lessons</p>
             </div>
          </div>
       `;
      card.onclick = () => window.attemptStartCourse(courseData.id);
      list.appendChild(card);
    });

  } catch (e) {
    console.error(e);
  }
})();
