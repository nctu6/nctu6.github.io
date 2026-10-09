/* 0x6.ai i18n: loads language.json and applies EN / 繁中 text to the page. */
(function () {
  const LANG_KEY = "0x6-lang";
  const SUPPORTED = ["zh-Hant", "en"];
  const LINE_STORE_BASE = "https://store.line.me/stickershop/author/5344394/";
  const page = document.body.dataset.page || "index";
  let dict = null;
  let lang = detectLang();
  const listeners = [];

  function detectLang() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (SUPPORTED.includes(saved)) return saved;
    } catch {}
    const prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
    for (const pref of prefs) {
      const tag = String(pref).toLowerCase();
      if (tag.startsWith("zh")) return "zh-Hant";
      if (tag.startsWith("en")) return "en";
    }
    return "en";
  }

  function lookup(code, key) {
    const d = dict && dict[code];
    if (!d) return undefined;
    return (d[page] && d[page][key]) ?? (d.common && d.common[key]);
  }

  function t(key) {
    return lookup(lang, key) ?? lookup("zh-Hant", key);
  }

  function lineUrl() {
    return LINE_STORE_BASE + (lang === "en" ? "en" : "zh-Hant");
  }

  function setPressed() {
    document.querySelectorAll(".lang-switch button").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang));
    });
  }

  function apply(next) {
    if (SUPPORTED.includes(next)) lang = next;
    document.documentElement.lang = lang;
    setPressed();
    document.querySelectorAll("[data-line-store]").forEach((el) => { el.href = lineUrl(); });
    if (!dict) return;
    const title = t("docTitle");
    if (title) document.title = title;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const v = t(el.dataset.i18n);
      if (v !== undefined) el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const v = t(el.dataset.i18nHtml);
      if (v !== undefined) el.innerHTML = v.replaceAll("{LINE}", lineUrl());
    });
    document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      el.dataset.i18nAttr.split(";").forEach((pair) => {
        const [attrName, key] = pair.split(":");
        if (!attrName || !key) return;
        const v = t(key.trim());
        if (v !== undefined) el.setAttribute(attrName.trim(), v);
      });
    });
    listeners.forEach((fn) => fn(lang));
  }

  document.querySelectorAll(".lang-switch button").forEach((btn) => {
    btn.addEventListener("click", () => {
      try { localStorage.setItem(LANG_KEY, btn.dataset.lang); } catch {}
      apply(btn.dataset.lang);
    });
  });

  window.I18n = {
    t,
    get lang() { return lang; },
    get ready() { return dict !== null; },
    onApply(fn) { listeners.push(fn); if (dict) fn(lang); }
  };

  apply(lang);
  fetch("language.json")
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((data) => { dict = data; apply(lang); })
    .catch(() => {});
})();
