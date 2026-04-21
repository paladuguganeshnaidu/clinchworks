/* =========================================================
   ClinchWorks Notification System
   Public API:
   - showToast(type, message, options?)
   - showModal(title, message, options?)
   Bonus:
   - showLoadingModal(title?, message?)
   - hideLoadingModal()
   - setNotificationSound(enabled)
   ========================================================= */
(function () {
  "use strict";

  const SOUND_PREF_KEY = "cw_notify_sound";
  const DEFAULT_TOAST_MS = 4200;
  const TOAST_MIN_MS = 1200;
  const TOAST_MAX_MS = 15000;

  let toastRegion = null;
  let loadingModalHandle = null;
  let audioContext = null;
  let soundEnabled = readSoundPreference();

  const ICONS = Object.freeze({
    success: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"></circle>
        <path class="cw-icon-check-path" d="M7 12.8l3.2 3.1L17.5 8.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `,
    error: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"></circle>
        <path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path>
      </svg>
    `,
    warning: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.6l9 15.6H3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path>
        <path d="M12 9v5.4M12 18h.01" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path>
      </svg>
    `,
    info: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"></circle>
        <path d="M12 10.5v5.5M12 7.8h.01" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path>
      </svg>
    `,
    loading: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-opacity="0.25" stroke-width="2"></circle>
        <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"></path>
      </svg>
    `
  });

  function normalizeType(type) {
    const value = String(type || "").toLowerCase();
    if (value === "success" || value === "error" || value === "warning" || value === "info") {
      return value;
    }
    return "info";
  }

  function normalizeDuration(value) {
    const numeric = Number.parseInt(value, 10);
    if (Number.isNaN(numeric)) return DEFAULT_TOAST_MS;
    return Math.min(TOAST_MAX_MS, Math.max(TOAST_MIN_MS, numeric));
  }

  function readSoundPreference() {
    try {
      const raw = localStorage.getItem(SOUND_PREF_KEY);
      if (raw === null) return false;
      return raw === "1" || raw === "true";
    } catch {
      return false;
    }
  }

  function writeSoundPreference(enabled) {
    try {
      localStorage.setItem(SOUND_PREF_KEY, enabled ? "1" : "0");
    } catch {
      // Ignore storage failures.
    }
  }

  function ensureToastRegion() {
    if (toastRegion && toastRegion.isConnected) return toastRegion;

    toastRegion = document.createElement("div");
    toastRegion.className = "cw-toast-region";
    toastRegion.setAttribute("aria-live", "polite");
    toastRegion.setAttribute("aria-atomic", "false");
    document.body.appendChild(toastRegion);
    return toastRegion;
  }

  function getIconMarkup(type) {
    return ICONS[type] || ICONS.info;
  }

  function getToastTitle(type) {
    if (type === "success") return "Success";
    if (type === "error") return "Error";
    if (type === "warning") return "Warning";
    return "Notice";
  }

  function ensureAudioContext() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioContext) {
      audioContext = new Ctx();
    }
    return audioContext;
  }

  function playTone(type) {
    if (!soundEnabled) return;

    const context = ensureAudioContext();
    if (!context) return;

    const frequencies = {
      success: [660, 880],
      error: [260, 180],
      warning: [520, 410],
      info: [500, 640]
    };

    const sequence = frequencies[type] || frequencies.info;

    try {
      const now = context.currentTime;
      sequence.forEach((freq, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.03, now + 0.01 + index * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12 + index * 0.1);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now + index * 0.1);
        oscillator.stop(now + 0.15 + index * 0.1);
      });
    } catch {
      // Audio can fail before user gesture; ignore safely.
    }
  }

  function showToast(type, message, options) {
    const toastType = normalizeType(type);
    const text = String(message || "").trim() || "Something happened.";
    const opts = options && typeof options === "object" ? options : {};
    const duration = normalizeDuration(opts.duration);

    const region = ensureToastRegion();
    const toast = document.createElement("article");
    toast.className = "cw-toast";
    toast.dataset.type = toastType;
    toast.setAttribute("role", toastType === "error" ? "alert" : "status");

    const icon = document.createElement("div");
    icon.className = "cw-toast-icon";
    icon.innerHTML = getIconMarkup(toastType);

    const body = document.createElement("div");
    body.className = "cw-toast-body";

    const title = document.createElement("h4");
    title.className = "cw-toast-title";
    title.textContent = String(opts.title || getToastTitle(toastType));

    const msg = document.createElement("p");
    msg.className = "cw-toast-message";
    msg.textContent = text;

    const closeButton = document.createElement("button");
    closeButton.className = "cw-toast-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close notification");
    closeButton.innerHTML = "&#10005;";

    const progress = document.createElement("div");
    progress.className = "cw-toast-progress";
    progress.style.animationDuration = `${duration}ms`;

    body.appendChild(title);
    body.appendChild(msg);
    toast.appendChild(icon);
    toast.appendChild(body);
    toast.appendChild(closeButton);
    toast.appendChild(progress);
    region.appendChild(toast);

    let dismissTimer = null;
    let startedAt = Date.now();
    let remaining = duration;
    let removed = false;

    const removeToast = () => {
      if (removed) return;
      removed = true;
      clearTimeout(dismissTimer);
      toast.classList.remove("is-visible");
      toast.classList.add("is-hiding");
      window.setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 250);
    };

    const startTimer = () => {
      startedAt = Date.now();
      clearTimeout(dismissTimer);
      dismissTimer = window.setTimeout(removeToast, remaining);
    };

    const pauseTimer = () => {
      if (removed) return;
      clearTimeout(dismissTimer);
      remaining = Math.max(0, remaining - (Date.now() - startedAt));
      toast.classList.add("is-paused");
    };

    const resumeTimer = () => {
      if (removed) return;
      if (remaining <= 0) {
        removeToast();
        return;
      }
      toast.classList.remove("is-paused");
      startTimer();
    };

    closeButton.addEventListener("click", removeToast);
    toast.addEventListener("mouseenter", pauseTimer);
    toast.addEventListener("mouseleave", resumeTimer);

    window.requestAnimationFrame(() => {
      toast.classList.add("is-visible");
      startTimer();
      playTone(toastType);
    });

    return { dismiss: removeToast };
  }

  function openModal(title, message, options) {
    const opts = Object.assign(
      {
        type: "info",
        confirmText: "OK",
        cancelText: "",
        closeOnOverlay: true,
        closeOnEsc: true,
        showClose: true,
        loading: false
      },
      options && typeof options === "object" ? options : {}
    );

    const modalType = normalizeType(opts.type);
    const safeTitle = String(title || "Notice");
    const safeMessage = String(message || "");

    const layer = document.createElement("div");
    layer.className = "cw-modal-layer";

    const backdrop = document.createElement("div");
    backdrop.className = "cw-modal-backdrop";

    const panel = document.createElement("section");
    panel.className = "cw-modal-panel";
    panel.dataset.type = modalType;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");

    const content = document.createElement("div");
    content.className = "cw-modal-content";

    const closeButton = document.createElement("button");
    closeButton.className = "cw-modal-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close dialog");
    closeButton.innerHTML = "&#10005;";

    const head = document.createElement("div");
    head.className = "cw-modal-head";

    const icon = document.createElement("div");
    icon.className = "cw-modal-icon";
    icon.innerHTML = opts.loading ? ICONS.loading : getIconMarkup(modalType);

    const textWrap = document.createElement("div");
    const titleEl = document.createElement("h3");
    titleEl.className = "cw-modal-title";
    titleEl.textContent = safeTitle;

    const messageEl = document.createElement("p");
    messageEl.className = "cw-modal-message";
    messageEl.textContent = safeMessage;

    textWrap.appendChild(titleEl);
    textWrap.appendChild(messageEl);
    head.appendChild(icon);
    head.appendChild(textWrap);

    content.appendChild(closeButton);
    content.appendChild(head);

    if (opts.loading) {
      const loadingRow = document.createElement("div");
      loadingRow.className = "cw-modal-loading";
      loadingRow.innerHTML = '<span class="cw-loading-ring" aria-hidden="true"></span><span>Working on your request...</span>';
      content.appendChild(loadingRow);
      panel.classList.add("is-loading");
    }

    const actions = document.createElement("div");
    actions.className = "cw-modal-actions";

    let cancelBtn = null;
    let confirmBtn = null;

    if (!opts.loading && opts.cancelText) {
      cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "cw-modal-btn cw-modal-btn-secondary";
      cancelBtn.textContent = String(opts.cancelText);
      actions.appendChild(cancelBtn);
    }

    if (!opts.loading && opts.confirmText) {
      confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.className = "cw-modal-btn cw-modal-btn-primary";
      confirmBtn.textContent = String(opts.confirmText);
      actions.appendChild(confirmBtn);
    }

    if (actions.childElementCount > 0) {
      panel.appendChild(content);
      panel.appendChild(actions);
    } else {
      panel.appendChild(content);
    }

    if (!opts.showClose || opts.loading) {
      closeButton.style.display = "none";
    }

    layer.appendChild(backdrop);
    layer.appendChild(panel);
    document.body.appendChild(layer);

    const previousFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    let settled = false;
    let resolver = null;

    const promise = new Promise((resolve) => {
      resolver = resolve;
    });

    const cleanup = (action) => {
      if (settled) return;
      settled = true;

      document.removeEventListener("keydown", onKeyDown);
      layer.classList.remove("is-visible");

      window.setTimeout(() => {
        if (layer.parentNode) {
          layer.parentNode.removeChild(layer);
        }
        if (previousFocused && typeof previousFocused.focus === "function") {
          previousFocused.focus();
        }
        if (typeof resolver === "function") {
          resolver({ action });
        }
      }, 220);
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape" && opts.closeOnEsc && !opts.loading) {
        event.preventDefault();
        cleanup("escape");
      }
    };

    document.addEventListener("keydown", onKeyDown);

    if (opts.closeOnOverlay && !opts.loading) {
      backdrop.addEventListener("click", () => cleanup("overlay"));
    }

    closeButton.addEventListener("click", () => cleanup("close"));

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => cleanup("cancel"));
    }

    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => cleanup("confirm"));
    }

    window.requestAnimationFrame(() => {
      layer.classList.add("is-visible");
      if (confirmBtn) {
        confirmBtn.focus();
      } else if (closeButton.style.display !== "none") {
        closeButton.focus();
      } else {
        panel.setAttribute("tabindex", "-1");
        panel.focus();
      }

      if (!opts.loading) {
        playTone(modalType);
      }
    });

    return { close: cleanup, promise };
  }

  function showModal(title, message, options) {
    return openModal(title, message, options).promise;
  }

  function showLoadingModal(title, message) {
    if (loadingModalHandle) {
      return loadingModalHandle.promise;
    }

    loadingModalHandle = openModal(
      title || "Please wait",
      message || "We are processing your request.",
      {
        type: "info",
        loading: true,
        closeOnOverlay: false,
        closeOnEsc: false,
        showClose: false,
        confirmText: "",
        cancelText: ""
      }
    );

    loadingModalHandle.promise.finally(() => {
      loadingModalHandle = null;
    });

    return loadingModalHandle.promise;
  }

  function hideLoadingModal() {
    if (!loadingModalHandle) return;
    loadingModalHandle.close("complete");
  }

  function setNotificationSound(enabled) {
    soundEnabled = !!enabled;
    writeSoundPreference(soundEnabled);
    return soundEnabled;
  }

  function isNotificationSoundEnabled() {
    return soundEnabled;
  }

  window.showToast = showToast;
  window.showModal = showModal;
  window.showLoadingModal = showLoadingModal;
  window.hideLoadingModal = hideLoadingModal;
  window.setNotificationSound = setNotificationSound;
  window.NotificationCenter = Object.freeze({
    showToast,
    showModal,
    showLoadingModal,
    hideLoadingModal,
    setNotificationSound,
    isNotificationSoundEnabled
  });
})();
