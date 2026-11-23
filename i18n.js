/* 0x6.ai i18n: loads language.json and applies 繁中 / EN / 日本語 text to the page.
   A page lists the languages it has in <body data-langs="...">; without it, a page has 繁中 and EN.
   ?lang=ja (or en, zh-Hant) picks the language for that URL, so a policy page has a stable link per
   language; otherwise the saved choice, then the browser's languages, decide. A Japanese browser on a
   page without 日本語 gets EN. Missing keys fall back: ja → en → zh-Hant, en → zh-Hant. */
(function () {
  const LANG_KEY = "0x6-lang";
  const ALL = ["zh-Hant", "en", "ja"];
  const FALLBACK = { "zh-Hant": [], en: ["zh-Hant"], ja: ["en", "zh-Hant"] };
  const LINE_STORE_BASE = "https://store.line.me/stickershop/author/5344394/";
  const page = document.body.dataset.page || "index";
  const SUPPORTED = (document.body.dataset.langs || "zh-Hant en").split(/\s+/).filter((code) => ALL.includes(code));
  let dict = null;
  let lang = detectLang();
  const listeners = [];

  function normalize(tag) {
    const s = String(tag || "").toLowerCase();
    if (s.startsWith("zh")) return "zh-Hant";
    if (s.startsWith("en")) return "en";
    if (s.startsWith("ja")) return "ja";
    return "";
  }

  function urlLang() {
    try { return normalize(new URLSearchParams(location.search).get("lang")); } catch { return ""; }
  }

  function detectLang() {
    const fromUrl = urlLang();
    if (SUPPORTED.includes(fromUrl)) return fromUrl;
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (SUPPORTED.includes(saved)) return saved;
    } catch {}
    const prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
    for (const pref of prefs) {
      const code = normalize(pref);
      if (code && SUPPORTED.includes(code)) return code;
    }
    return "en";
  }

  function lookup(code, key) {
    const d = dict && dict[code];
    if (!d) return undefined;
    return (d[page] && d[page][key]) ?? (d.common && d.common[key]);
  }

  function t(key) {
    for (const code of [lang, ...FALLBACK[lang]]) {
      const v = lookup(code, key);
      if (v !== undefined) return v;
    }
    return undefined;
  }

  function lineUrl() {
    return LINE_STORE_BASE + (lang === "zh-Hant" ? "zh-Hant" : "en");
  }

  function setPressed() {
    document.querySelectorAll(".lang-switch button").forEach((btn) => {
      btn.hidden = !SUPPORTED.includes(btn.dataset.lang);
      btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang));
    });
  }

  /* Keep an explicit ?lang= in step with the switcher, so a reload or a copied link shows the chosen language. */
  function syncUrlLang() {
    try {
      const params = new URLSearchParams(location.search);
      if (!params.has("lang") || params.get("lang") === lang) return;
      params.set("lang", lang);
      history.replaceState(null, "", `${location.pathname}?${params}${location.hash}`);
    } catch {}
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
      syncUrlLang();
    });
  });

  window.I18n = {
    t,
    get lang() { return lang; },
    get ready() { return dict !== null; },
    onApply(fn) { listeners.push(fn); if (dict) fn(lang); }
  };

  apply(lang);
  fetch(document.body.dataset.i18nSrc || "/language.json")
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((data) => { dict = data; apply(lang); })
    .catch(() => {});
})();
