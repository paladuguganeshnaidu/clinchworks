(() => {
  const mountId = "site-footer";
  const templatePath = "/assets/partials/footer.html";

  function sanitizeFooterMarkup(markup) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(markup || ""), "text/html");

    doc.querySelectorAll("script, iframe, object, embed, link[rel='import']").forEach((node) => {
      node.remove();
    });

    doc.querySelectorAll("*").forEach((node) => {
      const attrs = Array.from(node.attributes || []);
      attrs.forEach((attr) => {
        const name = String(attr.name || "").toLowerCase();
        const value = String(attr.value || "");

        if (name.startsWith("on")) {
          node.removeAttribute(attr.name);
          return;
        }

        const isUrlAttr = name === "href" || name === "src" || name === "xlink:href" || name === "formaction";
        if (isUrlAttr && /^\s*javascript:/i.test(value)) {
          node.removeAttribute(attr.name);
        }
      });
    });

    return doc.body.innerHTML;
  }

  async function loadFooter() {
    const mount = document.getElementById(mountId);
    if (!mount || mount.dataset.footerLoaded === "true") {
      return;
    }

    try {
      const response = await fetch(templatePath, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to load footer template: ${response.status}`);
      }

      const templateHtml = await response.text();
      mount.innerHTML = sanitizeFooterMarkup(templateHtml);
      mount.dataset.footerLoaded = "true";
    } catch (error) {
      console.error("Footer load error", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadFooter, { once: true });
  } else {
    loadFooter();
  }
})();
