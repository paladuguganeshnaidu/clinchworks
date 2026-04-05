/**
 * ClinchWorks Modular Script Core
 * Handles Navigation, Hover Dropdowns, and UI Interactions
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    initApp();
  });

  function initApp() {
    initHoverNav();
    initMobileMenu();
    initScrollEffects();
    initRevealAnimations();
    initSmoothScroll();
    
    updateActiveNav();
    window.addEventListener('scroll', updateActiveNav, { passive: true });
  }

  /**
   * Hover-Based Secondary Navigation
   */
  function initHoverNav() {
    const navItems = document.querySelectorAll('.nav-has-dropdown');
    const subNavContainer = document.getElementById('sub-nav-container');
    const dropdownContents = document.querySelectorAll('.dropdown-content');

    if (!subNavContainer) return;

    let hideTimeout;

    // Show appropriate dropdown on hover
    navItems.forEach(item => {
      item.addEventListener('mouseenter', () => {
        clearTimeout(hideTimeout);
        
        // Hide all dropdowns
        dropdownContents.forEach(el => el.classList.add('hidden'));
        
        // Show target dropdown
        const targetId = item.getAttribute('data-target');
        const targetContent = document.getElementById(targetId);
        
        if (targetContent) {
          targetContent.classList.remove('hidden');
          
          // Show container
          subNavContainer.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-[-10px]');
          subNavContainer.classList.add('opacity-100', 'translate-y-0');
        }
      });

      // Start hide timer when leaving the nav item
      item.addEventListener('mouseleave', () => {
        hideTimeout = setTimeout(() => {
          subNavContainer.classList.add('opacity-0', 'pointer-events-none', 'translate-y-[-10px]');
          subNavContainer.classList.remove('opacity-100', 'translate-y-0');
        }, 150); // slight delay for smooth transition
      });
    });

    // Keep sub-nav visible while hovering over the sub-nav itself
    subNavContainer.addEventListener('mouseenter', () => {
      clearTimeout(hideTimeout);
    });

    subNavContainer.addEventListener('mouseleave', () => {
      hideTimeout = setTimeout(() => {
        subNavContainer.classList.add('opacity-0', 'pointer-events-none', 'translate-y-[-10px]');
        subNavContainer.classList.remove('opacity-100', 'translate-y-0');
      }, 150);
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
