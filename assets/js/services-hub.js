(function initServicesHubSubnav() {
  const links = Array.from(document.querySelectorAll('.service-hub-link'));
  if (!links.length) return;

  const inactiveStyle = 'color: var(--cta-text); border: 1px solid var(--cta-border); background: transparent;';
  const activeStyle = 'background: #F7C763; color: #0b1220; border: 1px solid rgba(255,255,255,0.2);';

  const path = (window.location.pathname || '').toLowerCase();
  const normalizedPath = path.replace(/\/+$/, '');
  const currentService =
    (normalizedPath.endsWith('/ai-development') || normalizedPath.endsWith('/ai-development.html')) ? 'ai-development' :
    (normalizedPath.endsWith('/web-development') || normalizedPath.endsWith('/web-development.html')) ? 'web-development' :
    (normalizedPath.endsWith('/web-hosting') || normalizedPath.endsWith('/web-hosting.html')) ? 'web-hosting' :
    (normalizedPath.endsWith('/growth-optimization') || normalizedPath.endsWith('/growth-optimization.html')) ? 'growth-optimization' :
    null;

  links.forEach((link) => {
    link.setAttribute('style', inactiveStyle);
    link.removeAttribute('aria-current');

    if (currentService && link.getAttribute('data-service') === currentService) {
      link.setAttribute('style', activeStyle);
      link.setAttribute('aria-current', 'page');
    }
  });
})();
