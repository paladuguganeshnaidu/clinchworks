function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

(async function () {
  const params = new URLSearchParams(window.location.search);
  const category = params.get('category');

  try {
    const response = await fetch('/courses-content.json');
    const data = await response.json();

    // Filter by category if specified, else show all
    const courses = category
      ? data.courses.filter(c => c.category.toLowerCase() === category.toLowerCase())
      : data.courses;

    if (category) {
      const titleEl = document.getElementById('category-title');
      titleEl.textContent = '';
      titleEl.appendChild(document.createTextNode(`${category} `));
      const suffix = document.createElement('span');
      suffix.className = 'text-slate-400';
      suffix.textContent = 'Path';
      titleEl.appendChild(suffix);
    }

    const container = document.getElementById('course-list');
    container.innerHTML = '';

    if (courses.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'col-span-full py-24 text-center text-slate-400 italic';
      empty.textContent = 'No programs found in this category.';
      container.appendChild(empty);
      return;
    }

    courses.forEach(course => {
      const safeId = encodeURIComponent(String(course.id || ''));
      const card = document.createElement('div');
      card.className = 'group bg-[#F7C763] rounded-[32px] p-10 border border-transparent shadow-xl shadow-slate-200 transition-all duration-300 hover:translate-y-[-8px] hover:shadow-2xl cursor-pointer relative overflow-hidden';
      card.onclick = () => window.location.href = `/course?id=${safeId}`;

      card.innerHTML = `
        <div class="absolute top-0 right-0 w-24 h-24 bg-white/20 rounded-bl-full transform translate-x-12 translate-y-[-12px] group-hover:scale-150 transition-transform duration-500"></div>
        
        <div class="flex items-center gap-4 mb-10">
          <span class="text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1.5 bg-white text-black border border-slate-100 rounded-lg">${escapeHtml(course.level)}</span>
          <span class="text-[9px] font-bold text-slate-800 uppercase tracking-widest">${escapeHtml(course.duration)}</span>
        </div>
        
        <h3 class="text-2xl font-black text-slate-900 mb-6 leading-tight">${escapeHtml(course.title)}</h3>
        
        <p class="text-slate-800 text-sm leading-relaxed mb-10 line-clamp-3">
          ${escapeHtml(course.description)}
        </p>
        
        <div class="flex items-center gap-3 text-black font-bold text-xs uppercase tracking-widest pt-6 border-t border-slate-800/10">
          Explore Roadmap 
          <svg class="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (e) {
    console.error('Failed to load courses', e);
  }
})();
