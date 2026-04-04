const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

const headMatch = html.match(/(.*?<\/header>)/s);
const preHeader = headMatch ? headMatch[1] : '';

const mobileMenuMatch = html.match(/(<div id="mobile-menu".*?<\/div>)/s);
const mobileMenu = mobileMenuMatch ? mobileMenuMatch[1] : '';

const footerMatch = html.match(/(<footer.*<\/html>)/s);
const footer = footerMatch ? footerMatch[1] : '';

function createPage(filename, title, content) {
    let pageHtml = preHeader.replace('<title>Clinch Works — Engineering That Delivers</title>', `<title>${title} — Clinch Works</title>`);
    
    // We will wrap content in hero-like spacing
    let fullHtml = pageHtml + '\n\n' + mobileMenu + '\n\n<div class="pt-24 min-h-screen">\n' + content + '\n</div>\n\n' + footer;
    
    fs.writeFileSync(filename, fullHtml, 'utf8');
    console.log(`Generated ${filename}`);
}

const servicesContent = `
  <section class="relative py-16 sm:py-24 lg:py-32">
    <div class="max-w-5xl mx-auto px-5 sm:px-6">
      <div class="section-reveal visible">
        <div class="accent-line mb-4"></div>
        <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight" style="color: var(--text-primary);">
          Our Services
        </h1>
        <p class="mt-4 sm:mt-6 text-base sm:text-lg max-w-2xl leading-relaxed" style="color: var(--text-faint);">
          We don't specialize in narrow stacks. We specialize in problem solving and system execution. We offer end-to-end development, architecture, and automation services to scale your operations.
        </p>
      </div>

      <div class="mt-12 sm:mt-20 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div class="service-card section-reveal visible rounded-2xl p-8">
          <div class="w-12 h-12 flex items-center justify-center rounded-xl text-xl mb-6 font-mono"
            style="background: var(--icon-bg); color: var(--accent);">&lt;/&gt;</div>
          <h3 class="font-bold text-xl" style="color: var(--text-primary);">Full-Stack Web Development</h3>
          <p class="mt-4 text-sm leading-relaxed" style="color: var(--text-faint);">
            From interactive landing pages to highly scalable SaaS platforms. We build resilient applications that focus on user experience, maintainability, and enterprise-grade performance.
          </p>
          <ul class="mt-6 space-y-2 text-sm" style="color: var(--text-muted);">
             <li class="flex items-center gap-2"><span style="color: var(--accent);">→</span> React, Next.js, Vue</li>
             <li class="flex items-center gap-2"><span style="color: var(--accent);">→</span> Node.js, Python, Go</li>
             <li class="flex items-center gap-2"><span style="color: var(--accent);">→</span> SQL & NoSQL Databases</li>
          </ul>
        </div>

        <div class="service-card section-reveal visible rounded-2xl p-8">
          <div class="w-12 h-12 flex items-center justify-center rounded-xl text-xl mb-6 font-mono"
            style="background: var(--icon-bg); color: var(--accent);">☁</div>
          <h3 class="font-bold text-xl" style="color: var(--text-primary);">Cloud Architecture & DevOps</h3>
          <p class="mt-4 text-sm leading-relaxed" style="color: var(--text-faint);">
            We design, deploy, and manage scalable cloud infrastructure. Automate deployment workflows to eliminate manual errors and ensure continuous delivery with high availability.
          </p>
          <ul class="mt-6 space-y-2 text-sm" style="color: var(--text-muted);">
             <li class="flex items-center gap-2"><span style="color: var(--accent);">→</span> AWS, Google Cloud, Azure</li>
             <li class="flex items-center gap-2"><span style="color: var(--accent);">→</span> Docker & Kubernetes</li>
             <li class="flex items-center gap-2"><span style="color: var(--accent);">→</span> CI/CD Pipeline Automation</li>
          </ul>
        </div>

        <div class="service-card section-reveal visible rounded-2xl p-8">
          <div class="w-12 h-12 flex items-center justify-center rounded-xl text-xl mb-6 font-mono"
            style="background: var(--icon-bg); color: var(--accent);">⬡</div>
          <h3 class="font-bold text-xl" style="color: var(--text-primary);">System Integration & APIs</h3>
          <p class="mt-4 text-sm leading-relaxed" style="color: var(--text-faint);">
            Connect distributed systems and create unified platforms. We build RESTful and GraphQL APIs that handle complex distributed architectures seamlessly.
          </p>
        </div>

        <div class="service-card section-reveal visible rounded-2xl p-8">
          <div class="w-12 h-12 flex items-center justify-center rounded-xl text-xl mb-6 font-mono"
            style="background: var(--icon-bg); color: var(--accent);">⚡</div>
          <h3 class="font-bold text-xl" style="color: var(--text-primary);">AI Integration Strategy</h3>
          <p class="mt-4 text-sm leading-relaxed" style="color: var(--text-faint);">
            Integrate Large Language Models (LLMs) and intelligent data processing directly into your operations, generating insights and augmenting internal workflows continuously.
          </p>
        </div>
      </div>
    </div>
  </section>
`;

const trainingContent = `
  <section class="relative py-16 sm:py-24 lg:py-32">
    <div class="max-w-5xl mx-auto px-5 sm:px-6">
      <div class="section-reveal visible">
        <div class="accent-line mb-4"></div>
        <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight" style="color: var(--text-primary);">
          Training Programs
        </h1>
        <p class="mt-4 sm:mt-6 text-base sm:text-lg max-w-2xl leading-relaxed" style="color: var(--text-faint);">
          We believe in training by building real systems. Skip the boilerplate and textbook theory. Engage with practical implementation, debugging hard systems, and mastering production readiness.
        </p>
      </div>

      <div class="mt-12 sm:mt-20 flex flex-col gap-8 sm:gap-12">
        <div class="service-card section-reveal visible rounded-2xl p-8 sm:p-10">
          <div class="flex flex-col md:flex-row gap-8 items-start">
             <div class="md:w-1/3">
                <h3 class="font-bold text-2xl mb-2" style="color: var(--text-primary);">Engineering Bootcamp</h3>
                <span class="text-xs font-mono px-3 py-1 rounded-full" style="background: var(--tag-bg); color: var(--tag-text);">12 Weeks</span>
             </div>
             <div class="md:w-2/3">
                <p class="text-sm leading-relaxed mb-6" style="color: var(--text-faint);">
                  An intensive course covering modern web stacks from database design to frontend architectures. You will deploy real applications out onto production clouds. Let us teach you how to think dynamically and execute effectively.
                </p>
                <a href="mailto:hello@clinchworks.in?subject=Enroll%20Engineering%20Bootcamp" class="inline-block text-sm px-6 py-3 rounded-lg transition-all duration-300 font-medium" style="color: var(--bg-primary); background: var(--accent); border: 1px solid var(--accent);">
                  Enroll Now
                </a>
             </div>
          </div>
        </div>

        <div class="service-card section-reveal visible rounded-2xl p-8 sm:p-10">
          <div class="flex flex-col md:flex-row gap-8 items-start">
             <div class="md:w-1/3">
                <h3 class="font-bold text-2xl mb-2" style="color: var(--text-primary);">Cyber Security Fundamentals</h3>
                <span class="text-xs font-mono px-3 py-1 rounded-full" style="background: var(--tag-bg); color: var(--tag-text);">8 Weeks</span>
             </div>
             <div class="md:w-2/3">
                <p class="text-sm leading-relaxed mb-6" style="color: var(--text-faint);">
                  Red team tactics and blue team strategies. Learn vulnerability research, penetration testing, standard offensive workflows and how to secure critical defense systems. Threat models are real, so are these lessons.
                </p>
                <a href="mailto:hello@clinchworks.in?subject=Enroll%20Security" class="inline-block text-sm px-6 py-3 rounded-lg transition-all duration-300 font-medium" style="background: transparent; color: var(--cta-text); border: 1px solid var(--cta-border);">
                  Request Syllabus
                </a>
             </div>
          </div>
        </div>
      </div>
    </div>
  </section>
`;

const projectsContent = `
  <section class="relative py-16 sm:py-24 lg:py-32">
    <div class="max-w-5xl mx-auto px-5 sm:px-6">
      <div class="section-reveal visible">
        <div class="accent-line mb-4"></div>
        <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight" style="color: var(--text-primary);">
          Our Projects
        </h1>
        <p class="mt-4 sm:mt-6 text-base sm:text-lg max-w-2xl leading-relaxed" style="color: var(--text-faint);">
          Internal tools, client solutions, and open-source contributions. This is proof of execution.
        </p>
      </div>

      <div class="mt-12 sm:mt-20 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div class="project-card service-card section-reveal visible rounded-2xl p-8 h-full flex flex-col">
          <div class="flex items-center justify-between mb-6">
             <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full" style="background: var(--accent); opacity: 0.8;"></span>
                <span class="text-xs font-mono uppercase tracking-wider" style="color: var(--text-faint);">Client Success</span>
             </div>
          </div>
          <h3 class="font-bold text-xl mb-3" style="color: var(--text-primary);">Vyrinth Identity Dashboard</h3>
          <p class="text-sm leading-relaxed flex-grow" style="color: var(--text-secondary);">
            Built a centralized security portal offering real-time intelligent threat mapping, network anomalies, and multi-cloud authentication compliance for an enterprise security division.
          </p>
          <div class="mt-8 flex flex-wrap gap-2">
             <span class="text-xs px-3 py-1.5 rounded-md font-mono" style="background: var(--tag-bg); color: var(--accent);">React</span>
             <span class="text-xs px-3 py-1.5 rounded-md font-mono" style="background: var(--tag-bg); color: var(--accent);">GraphQL</span>
          </div>
        </div>

        <div class="project-card service-card section-reveal visible rounded-2xl p-8 h-full flex flex-col">
          <div class="flex items-center justify-between mb-6">
             <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full" style="background: var(--accent); opacity: 0.8;"></span>
                <span class="text-xs font-mono uppercase tracking-wider" style="color: var(--text-faint);">Open Source</span>
             </div>
          </div>
          <h3 class="font-bold text-xl mb-3" style="color: var(--text-primary);">Clinch Cloud Engine</h3>
          <p class="text-sm leading-relaxed flex-grow" style="color: var(--text-secondary);">
            A suite of automated server provisioning scripts combining robust IAM rules with auto-scaling deployment. Built to minimize developer boilerplate during new project lifecycles.
          </p>
          <div class="mt-8 flex flex-wrap gap-2">
             <span class="text-xs px-3 py-1.5 rounded-md font-mono" style="background: var(--tag-bg); color: var(--accent);">Terraform</span>
             <span class="text-xs px-3 py-1.5 rounded-md font-mono" style="background: var(--tag-bg); color: var(--accent);">Bash</span>
          </div>
        </div>
      </div>
    </div>
  </section>
`;

createPage('services.html', 'Services', servicesContent);
createPage('training.html', 'Training', trainingContent);
createPage('projects.html', 'Projects', projectsContent);
