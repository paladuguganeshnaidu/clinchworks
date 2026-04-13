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
    const revealObserver = new IntersectionObserver(
      (entries) => { 
        entries.forEach(e => { 
          // Custom check for GSAP managed elements
          if (e.target.classList.contains('bento-item') || e.target.classList.contains('team-card')) {
            return; // Managed by GSAP
          }
          if (e.isIntersecting) e.target.classList.add('visible'); 
        }); 
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.section-reveal').forEach(el => revealObserver.observe(el));
    
    // Defer GSAP specific animations
    setTimeout(initGSAPAnimations, 100);
  }

  function initGSAPAnimations() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    const bentoContainers = document.querySelectorAll('.bento-grid-trigger');
    bentoContainers.forEach(container => {
      const items = container.querySelectorAll('.bento-item');
      gsap.fromTo(items, 
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.15,
          ease: "power3.out",
          scrollTrigger: {
            trigger: container,
            start: "top 85%",
            toggleActions: "play none none none"
          }
        }
      );
    });

    const teamContainers = document.querySelectorAll('.team-bento-trigger');
    teamContainers.forEach(container => {
      const items = container.querySelectorAll('.team-card');
      gsap.fromTo(items, 
        { opacity: 0 },
        {
          opacity: 1,
          duration: 1,
          stagger: 0.2,
          ease: "power2.out",
          scrollTrigger: {
            trigger: container,
            start: "top 80%",
            toggleActions: "play none none none"
          }
        }
      );
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
