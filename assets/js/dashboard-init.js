function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

document.addEventListener('DOMContentLoaded', () => (async function () {
  try {
    const [coursesResponse, progressResponse] = await Promise.all([
      fetch('/courses-content.json'),
      fetch('/api/progress/all', { credentials: 'same-origin' })
    ]);

    const data = await coursesResponse.json();
    const progressPayload = progressResponse.ok ? await progressResponse.json() : { courses: {} };
    const progressByCourse = progressPayload && progressPayload.courses ? progressPayload.courses : {};

    const dashboardList = document.getElementById('dashboard-list');
    if (dashboardList) dashboardList.innerHTML = '';

    if (!data.courses || data.courses.length === 0) {
      if (dashboardList) dashboardList.innerHTML = '<p style="color: var(--text-faint);">No courses available.</p>';
      return;
    }

    if (dashboardList) {
      data.courses.forEach(course => {
        let percent = 0;
        let statusText = "Not Started";
        let btnText = "Start";
        let btnColor = "var(--accent)";

        const pData = progressByCourse[course.id];
        if (pData && typeof pData === 'object') {
          const totalModules = Math.max(0, Number.parseInt(pData.totalModules, 10) || 0);
          const maxIndex = Math.max(1, totalModules - 1);
          const currentModule = Math.max(0, Number.parseInt(pData.currentModule, 10) || 0);

          percent = Math.min(100, Math.round((Math.min(currentModule, maxIndex) / maxIndex) * 100));
          if (pData.completed) percent = 100;

          if (pData.completed) {
            statusText = "Completed";
            btnText = "View";
            btnColor = "var(--success, #16a34a)";
          } else if (currentModule > 0 || percent > 0) {
            statusText = "In Progress";
            btnText = "Resume";
          }
        }

        const card = document.createElement('div');
        card.className = 'service-card p-6 sm:p-8 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6';

        const safeCategory = escapeHtml(course.category || 'TRAINING');
        const safeTitle = escapeHtml(course.title || 'Untitled Course');
        const safeStatus = escapeHtml(statusText);
        const safePercent = Number.isFinite(percent) ? percent : 0;
        const safeCourseId = encodeURIComponent(String(course.id || ''));

        const leftSide = `
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <span class="text-xs font-mono px-2 py-1 rounded" style="background: var(--tag-bg); color: var(--tag-text);">${safeCategory}</span>
              <span class="text-xs font-mono" style="color: ${statusText === 'Completed' ? 'var(--success, #16a34a)' : (statusText === 'In Progress' ? 'var(--accent)' : 'var(--text-faint)')};">${safeStatus}</span>
            </div>
            <h2 class="text-xl sm:text-2xl font-bold mb-2" style="color: var(--text-primary);">${safeTitle}</h2>
            <div class="w-full h-1.5 rounded-full overflow-hidden mt-4" style="background: var(--border-color, rgba(255,255,255,0.05)); max-w-xs;">
              <div class="h-full transition-all duration-500 ease-out" style="width: ${safePercent}%; background: ${btnColor};"></div>
            </div>
            <span class="text-xs font-mono mt-2 inline-block" style="color: var(--text-faint);">${safePercent}% Completed</span>
          </div>
        `;

        const btnLink = statusText === 'Not Started' ? `/course?id=${safeCourseId}` : `/player?id=${safeCourseId}`;

        const rightSide = `
          <div class="flex-shrink-0">
            <a href="${btnLink}" class="inline-block text-sm px-8 py-3 rounded-xl font-bold transition-all border text-center min-w-[120px]" style="background: ${btnColor}; border-color: ${btnColor}; color: var(--bg-primary);">
              ${btnText}
            </a>
          </div>
        `;

        card.innerHTML = leftSide + rightSide;
        dashboardList.appendChild(card);
      });
    }

  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
})());
