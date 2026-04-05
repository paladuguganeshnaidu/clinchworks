/**
 * ClinchWorks Modular Script Core
 * Handles Theme, Navigation, Component Loading, and UI Interactions
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    initApp();
  });

  async function initApp() {
    // 1. Identify context (base path)
    const isRoot = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/');
    const basePath = isRoot ? '' : '../';

    // 2. Load Global Components
    await loadComponents(basePath);

    // 3. Initialize Shared Handlers
    
    initMobileMenu();
    initScrollEffects();
    initRevealAnimations();
    initSmoothScroll();
    
    // 4. Update Active Nav State
    updateActiveNav();
    window.addEventListener('scroll', updateActiveNav, { passive: true });
  }

  /**
   * Dynamically fetches and injects components (Navbar, Footer)
   */
  async function loadComponents(basePath) {
    const header = document.getElementById('header');
    const footer = document.querySelector('footer');

    if (header) {
      try {
        const response = await fetch(`${basePath}components/navbar.html`);
        let html = await response.text();
        // Dynamic path replacement for subdirectories
        header.innerHTML = html.replace(/{basePath}/g, basePath);
      } catch (err) {
        console.error('Failed to load navbar:', err);
      }
    }

    if (footer) {
      try {
        const response = await fetch(`${basePath}components/footer.html`);
        let html = await response.text();
        footer.innerHTML = html;
      } catch (err) {
        console.error('Failed to load footer:', err);
      }
    }
  }

  /**
   * Theme Management
   */
   else {
        html.removeAttribute('data-theme');
      }
      
    };

    const getCurrentTheme = () => html.hasAttribute('data-theme') ? 'dark' : 'light';

    themeToggle.addEventListener('click', () => {
      setTheme(getCurrentTheme() === 'dark' ? 'light' : 'dark');
    });
  }

  /**
   * Mobile Navigation
   */
  function initMobileMenu() {
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobile-menu');
    if (!hamburger || !mobileMenu) return;

    const mobileLinks = mobileMenu.querySelectorAll('a');

    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      mobileMenu.classList.toggle('open');
      document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
    });

    const closeMobileMenu = () => {
      hamburger.classList.remove('active');
      mobileMenu.classList.remove('open');
      document.body.style.overflow = '';
    };

    mobileLinks.forEach(link => {
      link.addEventListener('click', () => closeMobileMenu());
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth >= 1024) closeMobileMenu();
    });
  }

  /**
   * Header Appearance on Scroll
   */
  function initScrollEffects() {
    const header = document.getElementById('header');
    if (!header) return;

    window.addEventListener('scroll', () => {
      if (window.scrollY > 40) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }, { passive: true });
  }

  /**
   * Reveal Animations
   */
  function initRevealAnimations() {
    const revealObserver = new IntersectionObserver(
      (entries) => { 
        entries.forEach(e => { 
          if (e.isIntersecting) e.target.classList.add('visible'); 
        }); 
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.section-reveal').forEach(el => revealObserver.observe(el));
  }

  /**
   * Navigation Active State Logic
   */
  function updateActiveNav() {
    const navItems = document.querySelectorAll('.top-nav-item');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileNavItems = mobileMenu ? mobileMenu.querySelectorAll('a[data-section]') : [];
    const sections = document.querySelectorAll('section[id]');

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

  /**
   * Smooth Scrolling Handles
   */
  function initSmoothScroll() {
    const header = document.getElementById('header');
    const headerHeight = header ? header.offsetHeight : 0;

    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href').substring(1);
        if (!targetId) return;
        
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          e.preventDefault();
          window.scrollTo({ 
            top: targetEl.offsetTop - headerHeight - 20, 
            behavior: 'smooth' 
          });
        }
      });
    });
  }

})();

