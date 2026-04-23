document.addEventListener('DOMContentLoaded', () => {
(function () {
  const params = new URLSearchParams(window.location.search);
  const courseId = params.get('id');
  const encodedCourseId = encodeURIComponent(String(courseId || ''));
  let currentModuleIndex = 0;
  let courseData = null;
  let state = { currentModule: 0, totalModules: 0, completed: false, examPassed: false, certificateIssued: false };

  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const modTitle = document.getElementById('module-title');
  const modContent = document.getElementById('module-content');
  const progress = document.getElementById('progress');
  const progPercent = document.getElementById('progress-percent');
  const progBar = document.getElementById('progress-bar');
  const sidebarContent = document.getElementById('sidebar-modules');
  const playerMain = document.querySelector('.player-main');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sanitizedInlineCache = new Map();
  const moduleContentCache = new Map();

  function redirectToTrainingLogin() {
    const target = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?redirect=${target}`;
  }

  if (sidebarContent) {
    sidebarContent.addEventListener('click', (event) => {
      const item = event.target.closest('.sidebar-module-item');
      if (!item) return;

      const idx = Number.parseInt(item.dataset.index, 10);
      if (!Number.isInteger(idx)) return;

      const isLocked = !state.completed && idx > state.currentModule;
      if (isLocked || idx === currentModuleIndex) return;

      currentModuleIndex = idx;
      window.history.pushState({}, '', `/player?id=${encodedCourseId}&module=${currentModuleIndex}`);
      renderModule();
    });
  }

  function normalizeState(raw, totalModules) {
    const modules = Number.isInteger(totalModules) ? totalModules : (Number.parseInt(raw && raw.totalModules, 10) || 0);
    const maxIndex = Math.max(0, modules - 1);
    const current = Math.min(maxIndex, Math.max(0, Number.parseInt(raw && raw.currentModule, 10) || 0));
    return {
      currentModule: current,
      totalModules: Math.max(0, modules),
      completed: !!(raw && raw.completed),
      examPassed: !!(raw && raw.examPassed),
      certificateIssued: !!(raw && raw.certificateIssued)
    };
  }

  function sanitizeInlineHtml(rawHtml) {
    const cached = sanitizedInlineCache.get(rawHtml);
    if (cached) {
      return cached;
    }

    const template = document.createElement('template');
    template.innerHTML = String(rawHtml || '');

    const allowedTags = new Set([
      'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'P', 'UL', 'OL', 'LI', 'PRE', 'CODE',
      'STRONG', 'EM', 'BR', 'A', 'SPAN', 'DIV', 'BLOCKQUOTE'
    ]);
    const allowedAttrs = new Set(['class', 'style', 'href', 'target', 'rel']);

    const allNodes = Array.from(template.content.querySelectorAll('*'));
    allNodes.forEach((el) => {
      if (!allowedTags.has(el.tagName.toUpperCase())) {
        el.replaceWith(document.createTextNode(el.textContent || ''));
        return;
      }

      Array.from(el.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = String(attr.value || '');

        if (name.startsWith('on') || !allowedAttrs.has(name)) {
          el.removeAttribute(attr.name);
          return;
        }

        if (name === 'href') {
          if (/^(javascript:|data:)/i.test(value.trim())) {
            el.removeAttribute('href');
          }
          return;
        }

        if (name === 'style') {
          if (/(expression|javascript:|@import|behavior|url\s*\(\s*['\"]?javascript:)/i.test(value)) {
            el.removeAttribute('style');
          }
          return;
        }

        if (name === 'target') {
          if (value !== '_blank') {
            el.removeAttribute('target');
          } else {
            el.setAttribute('rel', 'noopener noreferrer');
          }
        }
      });
    });

    const sanitized = template.innerHTML;
    sanitizedInlineCache.set(rawHtml, sanitized);
    return sanitized;
  }

  async function fetchCourseState() {
    try {
      const response = await fetch(`/api/progress?courseId=${encodedCourseId}`, { credentials: 'same-origin' });
      if (response.status === 401 || response.status === 403) {
        redirectToTrainingLogin();
        return false;
      }

      if (!response.ok) {
        throw new Error('Server API failed');
      }

      const payload = await response.json();
      state = normalizeState(payload.state || {}, state.totalModules);
      return true;
    } catch (err) {
      console.warn("API progress fetch failed, trying localStorage:", err);
      const local = localStorage.getItem(`cw_progress_${courseId}`);
      if (local) {
        state = normalizeState(JSON.parse(local), state.totalModules);
      } else {
        state = normalizeState({}, state.totalModules);
      }
      return true;
    }
  }

  async function saveCourseState(partialState) {
    state = normalizeState(Object.assign({}, state, partialState), state.totalModules);

    try {
      const response = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          courseId,
          state: {
            currentModule: state.currentModule,
            totalModules: state.totalModules,
            completed: state.completed
          }
        })
      });

      if (response.status === 401 || response.status === 403) {
        redirectToTrainingLogin();
        return;
      }

      if (response.ok) {
        const payload = await response.json();
        state = normalizeState(payload.state || state, state.totalModules);
        return;
      }
    } catch (err) {
      console.warn("API progress save failed, using localStorage:", err);
    }

    // Always sync with localStorage as fallback/backup
    localStorage.setItem(`cw_progress_${courseId}`, JSON.stringify(state));
  }

  async function init() {
    if (!courseId) {
      if (modTitle) modTitle.textContent = 'Invalid Course';
      if (modContent) modContent.textContent = 'Missing course identifier.';
      return;
    }

    try {
      const response = await fetch('/courses-content.json');
      const data = await response.json();
      courseData = data.courses.find(c => c.id === courseId);

      if (!courseData) {
        if (modTitle) modTitle.textContent = "Registry Error";
        if (modContent) modContent.textContent = "Course not found.";
        return;
      }

      document.title = `${courseData.title} | Clinch Works`;

      state.totalModules = courseData.modules.length;
      const hasAccess = await fetchCourseState();
      if (!hasAccess) return;

      state.totalModules = courseData.modules.length;
      await saveCourseState({ totalModules: state.totalModules });

      // Anti-back navigation / specific module
      const reqModStr = params.get('module');
      if (reqModStr !== null && !isNaN(parseInt(reqModStr))) {
        const reqIdx = parseInt(reqModStr);
        if (reqIdx >= 0 && (reqIdx <= state.currentModule || state.completed) && reqIdx < state.totalModules) {
          currentModuleIndex = reqIdx;
        } else {
          currentModuleIndex = state.currentModule;
          window.history.replaceState({}, '', `/player?id=${encodedCourseId}&module=${currentModuleIndex}`);
        }
      } else {
        currentModuleIndex = state.currentModule;
        window.history.replaceState({}, '', `/player?id=${encodedCourseId}&module=${currentModuleIndex}`);
      }

      // Safety progress logic
      if (!state.completed && currentModuleIndex > state.currentModule && currentModuleIndex < state.totalModules) {
        state.currentModule = currentModuleIndex;
      }
      saveCourseState({ currentModule: state.currentModule }).catch(() => { });

      renderSidebar();
      renderModule();

    } catch (error) {
      console.error(error);
      if (modTitle) modTitle.textContent = "Connection Failure";
    }
  }

  function renderSidebar() {
    if (!sidebarContent || !courseData) return;
    const fragment = document.createDocumentFragment();
    sidebarContent.innerHTML = '';

    courseData.modules.forEach((mod, idx) => {
      const item = document.createElement('div');
      item.className = 'sidebar-module-item';
      item.dataset.index = String(idx);

      const idxTag = document.createElement('span');
      idxTag.className = 'sidebar-module-number';
      idxTag.textContent = String(idx + 1);

      const titleTag = document.createElement('span');
      titleTag.className = 'sidebar-module-title';
      titleTag.textContent = String(mod.title || 'Untitled Module');

      item.appendChild(idxTag);
      item.appendChild(titleTag);
      fragment.appendChild(item);
    });

    sidebarContent.appendChild(fragment);
    const sidebarTitle = document.getElementById('sidebar-course-title');
    if (sidebarTitle) sidebarTitle.textContent = courseData.title;
    updateSidebarState();
  }

  function updateSidebarState() {
    if (!sidebarContent) return;
    Array.from(sidebarContent.children).forEach((el, idx) => {
      const isLocked = !state.completed && idx > state.currentModule;
      const isActive = idx === currentModuleIndex;
      el.classList.toggle('sidebar-locked', isLocked);
      el.setAttribute('aria-disabled', isLocked ? 'true' : 'false');
    });
  }

  function renderModule() {
    if (!courseData || !courseData.modules[currentModuleIndex]) return;

    // Progress validation
    if (!state.completed) {
      if (currentModuleIndex > state.currentModule) {
        state.currentModule = currentModuleIndex;
        saveCourseState({ currentModule: state.currentModule }).catch(() => { });
      }
    }

    const module = courseData.modules[currentModuleIndex];
    const isLast = currentModuleIndex === courseData.modules.length - 1;

    if (modTitle) modTitle.textContent = module.title;
    renderContent(module.content, currentModuleIndex);

    // Update UI
    let pct = 0;
    if (courseData.modules.length <= 1) {
      pct = state.completed ? 100 : 0;
    } else {
      pct = Math.round((currentModuleIndex / (courseData.modules.length - 1)) * 100) || 0;
    }
    if (progPercent) progPercent.textContent = `Progress: ${pct}%`;
    if (progBar) progBar.style.width = `${pct}%`;
    if (progress) progress.textContent = `Module ${currentModuleIndex + 1} of ${courseData.modules.length}`;

    // Metadata
    const meta = document.getElementById('module-meta');
    if (meta) {
      meta.innerHTML = '';
      const catTag = document.createElement('span');
      catTag.className = 'px-3 py-1 bg-white/10 text-slate-200 border border-[#ffd54f] text-[9px] font-black uppercase rounded-full';
      catTag.textContent = String(courseData.category || 'Training');
      const durTag = document.createElement('span');
      durTag.className = 'px-3 py-1 bg-white/8 text-slate-300 text-[9px] font-black uppercase rounded-full';
      durTag.textContent = String(courseData.duration || 'N/A');
      meta.appendChild(catTag);
      meta.appendChild(durTag);
      if (state.completed) {
        const reviewTag = document.createElement('span');
        reviewTag.className = 'px-3 py-1 bg-green-500/20 text-green-200 text-[9px] font-black uppercase rounded-full';
        reviewTag.textContent = 'Course Completed (Review)';
        meta.appendChild(reviewTag);
      }
    }

    // Nav logic
    if (btnPrev) {
      btnPrev.disabled = currentModuleIndex === 0;
      btnPrev.onclick = () => {
        currentModuleIndex--;
        window.history.pushState({}, '', `/player?id=${encodedCourseId}&module=${currentModuleIndex}`);
        renderModule();
      };
    }
    
    if (btnNext) {
      if (isLast || state.completed) {
        btnNext.textContent = state.completed ? 'Review Mode - See Exam ->' : 'Take Final Assessment';
      } else {
        btnNext.textContent = 'Continue ->';
      }

      btnNext.onclick = (isLast || state.completed) ? async () => {
        if (!state.completed) {
          state.completed = true;
          state.currentModule = Math.max(state.currentModule, courseData.modules.length - 1);
          await saveCourseState({ completed: true, currentModule: state.currentModule });
        }
        window.location.href = `/exam?id=${encodedCourseId}`;
      } : () => {
        currentModuleIndex++;
        window.history.pushState({}, '', `/player?id=${encodedCourseId}&module=${currentModuleIndex}`);
        renderModule();
      };
    }

    updateSidebarState();

    if (window.initCodeBlocks) initCodeBlocks();
    if (playerMain) {
      playerMain.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
  }

  function renderContent(content, moduleIndex) {
    if (!modContent) return;
    const cacheKey = `${encodedCourseId}:${moduleIndex}`;
    const cachedHtml = moduleContentCache.get(cacheKey);
    if (cachedHtml) {
      modContent.innerHTML = cachedHtml;
      return;
    }

    const fragment = document.createDocumentFragment();
    const lines = Array.isArray(content) ? content : [content];

    lines.forEach((lineRaw) => {
      const line = String(lineRaw || '');
      if (!line.trim()) return;

      if (line.startsWith('<')) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = sanitizeInlineHtml(line);
        fragment.appendChild(wrapper);
      } else {
        const p = document.createElement('p');
        p.className = "mb-6 leading-relaxed text-slate-200";
        p.textContent = line;
        fragment.appendChild(p);
      }
    });

    modContent.replaceChildren(fragment);

    modContent.querySelectorAll('pre code').forEach((block) => {
      if (window.hljs) {
        hljs.highlightElement(block);
      }

      const pre = block.parentElement;
      if (pre) pre.className = "p-6 bg-slate-950/90 rounded-xl my-8 overflow-x-auto border border-white/10";
    });

    moduleContentCache.set(cacheKey, modContent.innerHTML);
  }

  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    const mod = parseInt(params.get('module'));
    if (!isNaN(mod) && mod >= 0 && (mod <= state.currentModule || state.completed)) {
      currentModuleIndex = mod;
      renderModule();
    } else {
      currentModuleIndex = state.currentModule;
      window.history.replaceState({}, '', `/player?id=${encodedCourseId}&module=${currentModuleIndex}`);
      renderModule();
    }
  });

  init();
})();
});
