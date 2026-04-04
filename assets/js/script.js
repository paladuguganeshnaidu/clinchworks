(function () {
      'use strict';

      // === Theme Toggle ===
      const themeToggle = document.getElementById('theme-toggle');
      const html = document.documentElement;

      function setTheme(theme) {
        if (theme === 'dark') {
          html.setAttribute('data-theme', 'dark');
        } else {
          html.removeAttribute('data-theme');
        }
        localStorage.setItem('clinch-theme', theme);
      }

      function getCurrentTheme() {
        return html.hasAttribute('data-theme') ? 'dark' : 'light';
      }

      themeToggle.addEventListener('click', () => {
        setTheme(getCurrentTheme() === 'dark' ? 'light' : 'dark');
      });

      // === Mobile Menu ===
      const hamburger = document.getElementById('hamburger');
      const mobileMenu = document.getElementById('mobile-menu');
      const mobileLinks = mobileMenu.querySelectorAll('a');

      hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        mobileMenu.classList.toggle('open');
        document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
      });

      function closeMobileMenu() {
        hamburger.classList.remove('active');
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
      }

      mobileLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          const href = link.getAttribute('href');
          if (!href || (!href.startsWith('mailto') && !href.startsWith('http'))) {
            closeMobileMenu();
          }
          if (href && href.startsWith('#')) {
            e.preventDefault();
            const targetId = href.substring(1);
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
              setTimeout(() => {
                const headerHeight = header.offsetHeight;
                window.scrollTo({ top: targetEl.offsetTop - headerHeight - 20, behavior: 'smooth' });
              }, 100);
            }
          }
        });
      });

      // === Header scroll effect ===
      const header = document.getElementById('header');
      window.addEventListener('scroll', () => {
        if (window.scrollY > 40) {
          header.classList.add('scrolled');
        } else {
          header.classList.remove('scrolled');
        }
      }, { passive: true });

      // === Section reveal ===
      const revealObserver = new IntersectionObserver(
        (entries) => { entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }); },
        { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
      );
      document.querySelectorAll('.section-reveal').forEach(el => revealObserver.observe(el));

      // === Nav active state ===
      const navItems = document.querySelectorAll('.top-nav-item');
      const mobileNavItems = mobileMenu.querySelectorAll('a[data-section]');
      const sections = document.querySelectorAll('section[id]');

      function updateActiveNav() {
        let current = '';
        const scrollPos = window.scrollY + window.innerHeight / 2;
        sections.forEach(s => {
          if (scrollPos >= s.offsetTop && scrollPos < s.offsetTop + s.offsetHeight) {
            current = s.getAttribute('id');
          }
        });
        navItems.forEach(item => item.classList.toggle('active', item.dataset.section === current));
        mobileNavItems.forEach(item => item.classList.toggle('active', item.dataset.section === current));
      }

      window.addEventListener('scroll', updateActiveNav, { passive: true });
      updateActiveNav();

      // === Smooth scroll for desktop nav ===
      navItems.forEach(item => {
        item.addEventListener('click', (e) => {
          const href = item.getAttribute('href');
          if (href && href.startsWith('#')) {
            e.preventDefault();
            const target = document.getElementById(href.substring(1));
            if (target) {
              window.scrollTo({ top: target.offsetTop - header.offsetHeight - 20, behavior: 'smooth' });
            }
          }
        });
      });

      // === Smooth scroll for other anchor links ===
      document.querySelectorAll('a[href^="#"]').forEach(link => {
        if (link.closest('#top-nav') || link.closest('#mobile-menu')) return;
        link.addEventListener('click', (e) => {
          const href = link.getAttribute('href');
          if (href && href.startsWith('#')) {
            e.preventDefault();
            const target = document.getElementById(href.substring(1));
            if (target) window.scrollTo({ top: target.offsetTop - header.offsetHeight - 20, behavior: 'smooth' });
          }
        });
      });

      // Close mobile menu on resize to desktop
      window.addEventListener('resize', () => {
        if (window.innerWidth >= 1024) closeMobileMenu();
      });

    })();
