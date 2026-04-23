/**
 * ClinchWorks Modular Script Core
 * Handles Navigation, Hover Dropdowns, and UI Interactions
 */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const currentPath = window.location.pathname.toLowerCase();
  const isPlayerRoute = /\/(?:pages\/)?player(?:\.html)?$/.test(currentPath);

  document.addEventListener('DOMContentLoaded', () => {
    initApp();
  });

  function initApp() {
    initTheme();
    if (!isPlayerRoute && !prefersReducedMotion) {
      initPageTransitions();
    }
    initHoverNav();
    initMobileMenu();
    initScrollEffects();

    if (!isPlayerRoute) {
      initRevealAnimations();
    }

    initSmoothScroll();

    if (!isPlayerRoute) {
      updateActiveNav();
      window.addEventListener('scroll', updateActiveNav, { passive: true });
    }
  }

  function initTheme() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    toggle.classList.remove('hidden');

    const savedTheme = localStorage.getItem('cw-theme');
    const initialTheme = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark';
    applyTheme(initialTheme, false);

    toggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next, true);
    });
  }

  function applyTheme(theme, persist) {
    document.documentElement.setAttribute('data-theme', theme);

    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      toggle.title = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    }

    if (persist) {
      localStorage.setItem('cw-theme', theme);
    }
  }

  /**
   * Hover-Based Secondary Navigation (Full-Width)
   */
  function initHoverNav() {
    const navItems = document.querySelectorAll('.nav-has-dropdown');
    const secondaryNav = document.getElementById('secondary-nav');
    const dropdownContents = document.querySelectorAll('.dropdown-content');

    if (!secondaryNav) return;

    let hideTimeout;

    // Show appropriate dropdown on hover
    navItems.forEach(item => {
      item.addEventListener('mouseenter', () => {
        clearTimeout(hideTimeout);
        
        // Hide all dropdowns
        dropdownContents.forEach(el => el.classList.remove('flex'));
        dropdownContents.forEach(el => el.classList.add('hidden'));
        
        // Show target dropdown
        const targetId = item.getAttribute('data-target');
        const targetContent = document.getElementById(targetId);
        
        if (targetContent) {
          targetContent.classList.remove('hidden');
          targetContent.classList.add('flex'); // Ensure horizontal layout
          
          // Show container
          secondaryNav.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-[-10px]');
          secondaryNav.classList.add('opacity-100', 'translate-y-0');
        }
      });

      // Start hide timer when leaving the nav item
      item.addEventListener('mouseleave', () => {
        hideTimeout = setTimeout(() => {
          secondaryNav.classList.add('opacity-0', 'pointer-events-none', 'translate-y-[-10px]');
          secondaryNav.classList.remove('opacity-100', 'translate-y-0');
        }, 200); // 200ms delay for smooth transition and flicker prevention
      });
    });

    // Keep secondary-nav visible while hovering over the nav itself
    secondaryNav.addEventListener('mouseenter', () => {
      clearTimeout(hideTimeout);
    });

    secondaryNav.addEventListener('mouseleave', () => {
      hideTimeout = setTimeout(() => {
        secondaryNav.classList.add('opacity-0', 'pointer-events-none', 'translate-y-[-10px]');
        secondaryNav.classList.remove('opacity-100', 'translate-y-0');
      }, 200);
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
    if (prefersReducedMotion) {
      document.querySelectorAll('.section-reveal').forEach((el) => el.classList.add('visible'));
      return;
    }

    // Prepare stagger targets for premium sequential entrances.
    // This does not change HTML structure; it only adds classes/styles at runtime.
    document.querySelectorAll('.section-reveal, .bento-grid-trigger, .team-bento-trigger').forEach((container) => {

      const isGridOrList = container.classList.contains('grid') || container.tagName === 'UL' || container.tagName === 'OL' || container.classList.contains('flex');
      if (!isGridOrList) return;

      const children = Array.from(container.querySelectorAll(':scope > a, :scope > .service-card, :scope > .project-card, :scope > .module-card, :scope > .content-card, :scope > .bento-item, :scope > .team-card'));
      if (children.length < 2) return;

      children.forEach((child, idx) => {
        child.classList.add('cw-reveal-item');
        child.style.setProperty('--cw-stagger-delay', `${Math.min(idx * 80, 560)}ms`);
      });
    });

    const revealObserver = new IntersectionObserver(
      (entries) => { 
        entries.forEach(e => {          if (e.isIntersecting) {
            e.target.classList.add('visible');

            // If the reveal target is a grid/list container, also stagger-reveal its children.
            const staggerChildren = e.target.querySelectorAll(':scope > .cw-reveal-item');
            staggerChildren.forEach((child) => child.classList.add('cw-visible'));

            revealObserver.unobserve(e.target);
          }
        }); 
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('.section-reveal, .bento-grid-trigger, .team-bento-trigger').forEach((el, index) => {
      // Global reveal staggering for standalone blocks (0.05Ã¢â‚¬â€œ0.1s per item)
      el.style.setProperty('--reveal-delay', `${Math.min(index * 70, 420)}ms`);
      revealObserver.observe(el);
    });
    
    // Defer GSAP specific animations
  }







  function initPageTransitions() {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href]');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href) return;
      if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (link.target === '_blank' || link.hasAttribute('download')) return;

      const nextUrl = new URL(link.href, window.location.href);
      if (nextUrl.origin !== window.location.origin) return;

      // Allow native browser routing instantly, but append the exit animation
      document.body.classList.add('page-leave');
    });

    window.addEventListener('pageshow', () => {
      document.body.classList.remove('page-leave');
    });
  }

  /**
   * Navigation Active State Logic
   */
  function updateActiveNav() {
    const navItems = document.querySelectorAll('.top-nav-item');
    const sections = document.querySelectorAll('section[id]');

    let current = '';
    const scrollPos = window.scrollY + window.innerHeight / 2;
    sections.forEach(s => {
      if (scrollPos >= s.offsetTop && scrollPos < s.offsetTop + s.offsetHeight) {
        current = s.getAttribute('id');
      }
    });

    navItems.forEach(item => item.classList.toggle('active', item.dataset.section === current));
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


