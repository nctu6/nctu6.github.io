/* 0x6.ai apps: renders the portfolio and policy lists from apps.json. */
(function () {
  const LINE_STORE_BASE = "https://store.line.me/stickershop/author/5344394/";
  const UI = {
    "zh-Hant": {
      coming: "即將推出", dataUse: "資料使用", services: "第三方服務",
      privacy: "隱私權政策", terms: "條款", noServices: "無", aria: "開啟"
    },
    en: {
      coming: "Coming soon", dataUse: "Data use", services: "Third-party services",
      privacy: "privacy policy", terms: "terms", noServices: "None", aria: "Open"
    },
    ja: {
      coming: "近日公開", dataUse: "データの取り扱い", services: "外部サービス",
      privacy: "プライバシーポリシー", terms: "利用規約", noServices: "なし", aria: "開く"
    }
  };
  /* apps.json text fields are { "zh-Hant", "en" } with an optional "ja"; a missing "ja" falls back to "en". */
  const FALLBACK = { ja: ["en"] };
  const METRO_SVG = `<svg viewBox="0 0 400 230" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 40 H140 L200 100 V210" stroke="#e3002c"/><path d="M20 120 H380" stroke="#0070bd"/><path d="M260 20 V80 L200 140 V170 L150 220" stroke="#008659"/><path d="M80 200 L140 140 H300 L360 80" stroke="#f8b61c"/><path d="M300 140 L360 200 H390" stroke="#c48c31" stroke-dasharray="2 12" opacity="0.45"/><path d="M300 140 V180" stroke="#c48c31" opacity="0.45"/></g><g fill="#fff" stroke="#1f2a24" stroke-width="2.5"><circle cx="60" cy="40" r="4.5"/><circle cx="100" cy="40" r="4.5"/><circle cx="170" cy="70" r="4.5"/><circle cx="60" cy="120" r="4.5"/><circle cx="120" cy="120" r="4.5"/><circle cx="330" cy="120" r="4.5"/><circle cx="260" cy="45" r="4.5"/><circle cx="175" cy="195" r="4.5"/><circle cx="110" cy="170" r="4.5"/><circle cx="340" cy="100" r="4.5"/><circle cx="200" cy="190" r="4.5"/></g><g fill="#fff" stroke="#1f2a24" stroke-width="3"><circle cx="200" cy="120" r="9"/><circle cx="240" cy="120" r="8"/><circle cx="200" cy="140" r="8"/><circle cx="140" cy="40" r="8"/><circle cx="300" cy="140" r="8"/></g><g font-family="ui-monospace, Menlo, monospace" font-size="11" font-weight="700"><rect x="282" y="196" width="104" height="24" rx="5" fill="#1f2a24"/><text x="292" y="212" fill="#85e8be">LAST 24:49</text></g></svg>`;
  let data = null;
  const hooks = [];
  let resolveReady;
  const ready = new Promise((r) => { resolveReady = r; });

  const lang = () => (window.I18n ? I18n.lang : "zh-Hant");
  const pickLang = (v, lng) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return v;
    for (const code of [lng, ...(FALLBACK[lng] || [])]) if (v[code] !== undefined) return v[code];
    return v["zh-Hant"];
  };
  const L = (v) => pickLang(v, lang());
  const ui = (k) => (UI[lang()] || UI["zh-Hant"])[k] ?? UI["zh-Hant"][k];
  const lineUrl = () => LINE_STORE_BASE + (lang() === "zh-Hant" ? "zh-Hant" : "en");
  const urlOf = (app) => (app.url === "{LINE}" ? lineUrl() : L(app.localizedUrl) || app.url);

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    }
    children.flat().forEach((c) => { if (c !== null && c !== undefined) node.append(c); });
    return node;
  }
  const extLink = (href, text) => el("a", { href, target: "_blank", rel: "noopener", text });
  const externalIcon = () => el("img", { class: "icon", src: "/assets/portfolio/external.svg", width: 16, height: 16, alt: "" });
  const homeList = document.getElementById("works-list");
  let lineStickers = [];

  function stickerImages() {
    return lineStickers.map((item) => el("img", { src: item.image, alt: "", loading: "lazy", decoding: "async" }));
  }

  function visual(app) {
    if (app.visual === "x") {
      const post = (short) => el("div", { class: "x-post" }, el("span", { class: "x-avatar" }), el("span", { class: "x-line name" }), el("span", { class: short ? "x-line short" : "x-line" }));
      return el("div", { class: "x-visual", "aria-hidden": "true" },
        el("div", { class: "x-tabs" }, el("span", { text: "News" }), el("span", { text: "AI" }), el("span", { text: "Space" })),
        post(false), post(true), post(false));
    }
    if (app.visual === "line") {
      return el("div", { class: "line-visual", "aria-hidden": "true" }, stickerImages());
    }
    if (app.visual === "metro") {
      const box = el("div", { class: "map-visual metro-visual", "aria-hidden": "true" });
      box.innerHTML = METRO_SVG;
      return box;
    }
    if (app.visual === "map") {
      return el("div", { class: "map-visual", "aria-hidden": "true" },
        el("span", { class: "map-road r1" }), el("span", { class: "map-road r2" }), el("span", { class: "map-road r3" }),
        el("span", { class: "map-pin p1" }), el("span", { class: "map-pin p2" }), el("span", { class: "map-pin p3" }),
        el("span", { class: "map-me" }));
    }
    if (app.visual === "image" && app.image) {
      return el("div", { class: app.kind === "ios" ? "cover-visual is-app-icon" : "cover-visual" },
        el("img", { src: app.image, alt: "", loading: "lazy", decoding: "async" }));
    }
    return el("div", { class: "generic-visual", "aria-hidden": "true" }, el("span", { text: app.domain || "0x6.ai" }));
  }

  /* Works browser with shared popularity ranking and URL filters. */
  const PAGE_SIZE = 24;
  const VIEW_KEY = "0x6-works-view";
  const SORTS = ["popular", "newest", "oldest"];
  const CATEGORIES = ["ai", "ios", "web", "line"];
  const state = { q: "", category: "", tag: "", sort: "popular", limit: PAGE_SIZE, view: "grid", bound: false };
  const categoryOf = (app) => app.category || (app.kind === "store" ? "line" : app.kind);
  let scores = {}; /* from /popularity.json, collected daily by scripts/update-popularity.mjs */
  let hay = new WeakMap();

  /* Live counts from an app's optional statsApi (e.g. https://agentusecases.0x6.ai/stats.json).
     The number-free `description` is rendered first; once valid counts arrive, `descriptionStats` templates
     ({entries}, {agents}, ...) replace it in place. Only non-negative integers are accepted; a failed, slow
     (> STATS_TIMEOUT_MS) or invalid response leaves the number-free text, so no stale numbers ever show. */
  const STATS_TIMEOUT_MS = 5000;
  const stats = {};
  const isCount = (v) => Number.isSafeInteger(v) && v >= 0;

  function descText(app, lng = lang()) {
    const fallback = pickLang(app.description, lng) || "";
    const vars = stats[app.id];
    const tpl = pickLang(app.descriptionStats, lng);
    if (!vars || typeof tpl !== "string") return fallback;
    let ok = true;
    const out = tpl.replace(/\{(\w+)\}/g, (_, k) => (isCount(vars[k]) ? String(vars[k]) : ((ok = false), "")));
    return ok ? out : fallback;
  }

  function allDescTexts(app) {
    const d = app.description;
    return d && typeof d === "object" && !Array.isArray(d) ? Object.keys(d).map((k) => descText(app, k)) : descText(app);
  }

  const summaryText = (app) => L(app.summary) || descText(app);

  function refreshDesc(app) {
    if (homeList && state.q.trim()) renderWorks(homeList); /* search results may change with the new text */
    document.querySelectorAll("[data-desc-for]").forEach((n) => {
      if (n.getAttribute("data-desc-for") === app.id) n.textContent = descText(app);
    });
  }

  function loadStats() {
    data.apps.filter((a) => typeof a.statsApi === "string" && a.descriptionStats).forEach((app) => {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), STATS_TIMEOUT_MS);
      fetch(app.statsApi, { signal: ctl.signal, credentials: "omit" })
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (!json || typeof json !== "object" || Array.isArray(json)) return;
          if (json.id !== undefined && json.id !== app.id) return;
          const clean = {};
          Object.entries(json).forEach(([k, v]) => { if (isCount(v)) clean[k] = v; });
          stats[app.id] = clean;
          hay = new WeakMap();
          refreshDesc(app);
        })
        .catch(() => {})
        .finally(() => clearTimeout(timer));
    });
  }

  const T = (k, fb) => (window.I18n && I18n.t(k)) ?? fb ?? k;
  const fmt = (s, vars) => String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
  const slug = (s) => String(s).toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
  const listedApps = () => data.apps.filter((a) => a.listed);

  function tagKeys(app) {
    const t = app.tags;
    if (!t) return [];
    return (Array.isArray(t) ? t : (t.en || t["zh-Hant"] || [])).map(slug);
  }

  function haystack(app) {
    if (hay.has(app)) return hay.get(app);
    const parts = [];
    const add = (v) => {
      if (v === null || v === undefined) return;
      if (Array.isArray(v)) v.forEach(add);
      else if (typeof v === "object") Object.values(v).forEach(add);
      else parts.push(String(v));
    };
    [app.name, app.heading, app.summary, allDescTexts(app), app.tags, app.domain, app.work].forEach(add);
    (app.extra || []).forEach((e) => add(e.label));
    const s = parts.join("\n").toLowerCase();
    hay.set(app, s);
    return s;
  }

  const score = (app) => {
    const s = scores[app.id] && scores[app.id].score;
    return typeof s === "number" && Number.isFinite(s) ? s : null;
  };

  function sortApps(list, sort = state.sort) {
    const order = new Map(list.map((a, i) => [a, i])); /* apps.json order = newest first */
    const byAge = (a, b) => (sort === "oldest" ? order.get(b) - order.get(a) : order.get(a) - order.get(b));
    return list.slice().sort((a, b) => {
      const pin = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      if (pin) return pin;
      if (sort === "popular") {
        const sa = score(a), sb = score(b);
        if (sa !== null || sb !== null) {
          if (sa === null) return 1;
          if (sb === null) return -1;
          if (sb !== sa) return sb - sa;
        }
      }
      return byAge(a, b);
    });
  }

  function topPopular(list) {
    return sortApps(list.filter((a) => !a.pinned && score(a) !== null), "popular").slice(0, 3);
  }

  function filtered(list) {
    const terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    return list.filter((a) => {
      const category = categoryOf(a);
      const matchesCategory = !state.category || category === state.category || (state.category === "web" && category === "game");
      return matchesCategory && (!state.tag || tagKeys(a).includes(state.tag)) && terms.every((t) => haystack(a).includes(t));
    });
  }

  function popularCard(app) {
    const href = urlOf(app);
    return el(href ? "a" : "article", {
      class: "popular-card", href, target: href ? "_blank" : null, rel: href ? "noopener" : null, "data-app-id": app.id
    },
      el("div", { class: "tile-thumb", "aria-hidden": "true" }, visual(app)),
      el("div", { class: "popular-copy" },
        el("div", { class: "popular-meta" },
          el("span", { text: app.popularLabel || T("popularCategory-" + categoryOf(app), "PROJECT") }),
          href ? externalIcon() : null),
        el("h3", { text: L(app.shortName) || L(app.name) }),
        el("p", { text: summaryText(app) })));
  }

  function renderPopular(root) {
    const ranked = topPopular(listedApps());
    root.replaceChildren(...ranked.map(popularCard));
    root.closest("section").hidden = !ranked.length;
  }

  function tile(app, popular) {
    const href = urlOf(app);
    const name = L(app.name);
    const keys = tagKeys(app);
    const title = href
      ? el("a", { class: "tile-link", href, target: "_blank", rel: "noopener", "aria-label": ui("aria") + " " + name }, L(app.shortName) || name)
      : el("span", { class: "tile-link" }, name + " (" + ui("coming") + ")");
    return el("article", { class: "work-tile", id: app.id, "data-app-id": app.id },
      el("div", { class: "tile-thumb", "aria-hidden": "true" }, visual(app)),
      el("div", { class: "tile-meta" },
        app.pinned ? el("span", { class: "chip", text: T("worksPinnedBadge", "Pinned") }) : null,
        popular ? el("span", { class: "chip", text: T("worksPopularBadge", "Popular") }) : null),
      el("div", { class: "tile-info" },
        el("h3", { class: "tile-title" }, title),
        el("p", { class: "tile-category", text: T("worksCategory-" + categoryOf(app), app.kind) })),
      el("p", { class: "tile-summary", text: summaryText(app) }),
      el("span", { class: "tile-domain", text: app.domain || "" }),
      href ? externalIcon() : null,
      el("p", { class: "tile-desc", text: descText(app), "data-desc-for": app.statsApi ? app.id : null }),
      el("div", { class: "tile-foot" },
        el("div", { class: "tile-tags" }, (L(app.tags) || []).map((label, i) => el("button", {
          class: "chip", type: "button", text: label, "data-tag": keys[i], "aria-pressed": String(state.tag === keys[i])
        }))),
        (app.extra || []).map((e) => el("a", { class: "tile-extra", href: e.url, target: "_blank", rel: "noopener", text: L(e.label) + " ↗" }))));
  }

  function renderChips(list) {
    const root = document.getElementById("works-chips");
    const controls = ["", ...CATEGORIES].map((key) => {
      const label = key ? T("worksCategory-" + key, key) : T("worksTagAll", "All");
      const short = key && T("worksCategoryShort-" + key, "");
      return el("button", { type: "button", class: "chip", "data-category": key, "aria-pressed": String(state.category === key) },
        el("span", { class: "chip-full", text: label }), short ? el("span", { class: "chip-short", text: short }) : null);
    });
    if (state.tag) {
      const match = list.find((app) => tagKeys(app).includes(state.tag));
      const label = match ? L(match.tags)?.[tagKeys(match).indexOf(state.tag)] || state.tag : state.tag;
      controls.push(el("button", {
        type: "button", class: "chip", "data-tag": state.tag, "aria-pressed": "true",
        "aria-label": fmt(T("worksRemoveTag", "Remove tag {tag}"), { tag: label }), text: label + " ×"
      }));
    }
    root.replaceChildren(...controls);
  }

  function syncUrl() {
    const p = new URLSearchParams(location.search);
    const set = (k, v) => (v ? p.set(k, v) : p.delete(k));
    set("q", state.q.trim());
    set("category", state.category);
    set("tag", state.tag);
    set("sort", state.sort === "popular" ? "" : state.sort);
    const qs = p.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
  }

  function bindToolbar(root) {
    if (state.bound) return;
    state.bound = true;
    const p = new URLSearchParams(location.search);
    state.q = p.get("q") || "";
    state.category = CATEGORIES.includes(p.get("category")) ? p.get("category") : "";
    state.tag = slug(p.get("tag") || "");
    state.sort = SORTS.includes(p.get("sort")) ? p.get("sort") : "popular";
    try { if (localStorage.getItem(VIEW_KEY) === "list") state.view = "list"; } catch {}
    const q = document.getElementById("works-q");
    const sort = document.getElementById("works-sort");
    const rerender = (resetPage = true) => { if (resetPage) state.limit = PAGE_SIZE; syncUrl(); renderWorks(root); hooks.forEach((fn) => fn(data)); };
    if (q) {
      q.value = state.q;
      q.addEventListener("input", () => { state.q = q.value; rerender(); });
      q.addEventListener("keydown", (e) => { if (e.key === "Escape" && q.value) { q.value = ""; state.q = ""; rerender(); } });
    }
    if (sort) { sort.value = state.sort; sort.addEventListener("change", () => { state.sort = sort.value; rerender(); }); }
    document.getElementById("works")?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-category], button[data-tag]");
      if (!button) return;
      const { category, tag } = button.dataset;
      if (category !== undefined) state.category = category === state.category ? "" : category;
      else state.tag = state.tag === tag ? "" : tag;
      rerender();
      const group = document.getElementById("works-chips");
      const next = Array.from(group.children).find((item) => category === undefined
        ? item.dataset.tag === state.tag && state.tag : item.dataset.category === state.category);
      (next || group.firstElementChild)?.focus({ preventScroll: true });
    });
    document.querySelectorAll(".works-view button").forEach((b) => b.addEventListener("click", () => {
      state.view = b.dataset.view;
      try { localStorage.setItem(VIEW_KEY, state.view); } catch {}
      rerender(false);
    }));
    document.getElementById("works-more")?.addEventListener("click", () => { state.limit += PAGE_SIZE; rerender(false); });
    document.getElementById("works-clear")?.addEventListener("click", () => {
      state.q = ""; state.tag = ""; state.category = "";
      if (q) q.value = "";
      rerender();
      q?.focus();
    });
  }

  function renderWorks(root) {
    bindToolbar(root);
    const all = listedApps();
    const hits = sortApps(filtered(all));
    const popular = new Set(topPopular(all).map((app) => app.id));
    const page = hits.slice(0, state.limit);
    root.classList.toggle("is-list", state.view === "list");
    root.hidden = !page.length;
    root.removeAttribute("aria-busy");
    const caption = el("div", { class: "works-caption", "aria-hidden": "true" },
      el("span", { text: T("navWorks", "Works") }),
      el("span", { text: T("worksDescriptionColumn", "Description") }),
      el("span", { text: T("worksDomainColumn", "Domain") }));
    root.replaceChildren(caption, ...page.map((app) => tile(app, popular.has(app.id))));
    renderChips(all);
    document.querySelectorAll(".works-view button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === state.view)));
    const count = document.getElementById("works-count");
    if (count) {
      const active = state.q.trim() || state.tag || state.category;
      count.textContent = active
        ? fmt(T("worksCountFiltered", "{n} of {total} works"), { n: hits.length, total: all.length })
        : (all.length === 1 ? T("worksCountOne", "1 work") : fmt(T("worksCount", "{n} works"), { n: all.length }));
    }
    const empty = document.getElementById("works-empty");
    if (empty) empty.hidden = hits.length > 0;
    const more = document.getElementById("works-more");
    if (more) {
      const left = hits.length - page.length;
      more.hidden = left <= 0;
      more.textContent = fmt(T("worksShowMore", "Show more ({n} left)"), { n: left });
    }
  }

  function appTitle(app) {
    const href = urlOf(app);
    const name = L(app.name);
    if (href) return extLink(href, name);
    return el("span", { text: lang() === "en" ? `${name} (${ui("coming")})` : `${name}（${ui("coming")}）` });
  }

  function serviceLink(id) {
    const s = data.services[id];
    if (!s) return el("span", { text: id });
    return el("span", {}, el("b", { text: s.name }), document.createTextNode(" ("), extLink(s.privacy, ui("privacy")),
      s.terms ? [document.createTextNode(" · "), extLink(s.terms, ui("terms"))] : [], document.createTextNode(")"));
  }

  function renderServices(root) {
    root.innerHTML = "";
    const byCat = {};
    Object.entries(data.services).forEach(([id, s]) => { (byCat[s.category] ||= []).push(id); });
    Object.entries(byCat).forEach(([cat, ids]) => {
      const li = el("li", {}, el("b", { text: L(data.categories[cat]) }), document.createTextNode(lang() === "en" ? ": " : "："));
      ids.forEach((id, i) => {
        const s = data.services[id];
        if (i) li.append(document.createTextNode(lang() === "en" ? ", " : "、"));
        li.append(extLink(s.privacy, s.name));
      });
      root.append(li);
    });
  }

  function privacyDetails({ data: uses, services = [] }) {
    return [
      el("p", { class: "app-label", text: ui("dataUse") }),
      el("ul", {}, (L(uses) || []).map((text) => el("li", { text }))),
      el("p", { class: "app-label", text: ui("services") }),
      services.length ? el("ul", {}, services.map((id) => el("li", {}, serviceLink(id)))) : el("p", { text: ui("noServices") })
    ];
  }

  function renderCoverage(root) {
    const entries = data.apps.map((app) => {
      const details = app.privacyPlatforms
        ? app.privacyPlatforms.map((platform) => el("section", { class: "app-platform" },
          el("h4", { text: L(platform.name) }), privacyDetails(platform)))
        : privacyDetails(app);
      return el("div", { class: "app-entry" },
        el("h3", {}, appTitle(app)),
        el("div", { class: "app-meta", text: app.domain || "" }),
        details);
    });
    root.replaceChildren(...entries);
  }

  function renderTerms(root) {
    root.innerHTML = "";
    data.apps.forEach((app) => {
      root.append(el("li", {}, appTitle(app), app.disclaimer ? [document.createTextNode(lang() === "en" ? ": " : "："), L(app.disclaimer)] : []));
    });
  }

  function render() {
    if (!data) return;
    const map = { "popular-list": renderPopular, "works-list": renderWorks, "apps-coverage": renderCoverage, "services-list": renderServices, "terms-apps": renderTerms };
    Object.entries(map).forEach(([id, fn]) => { const root = document.getElementById(id); if (root) fn(root); });
    hooks.forEach((fn) => fn(data));
  }

  window.Apps = {
    ready,
    get data() { return data; },
    onRender(fn) { hooks.push(fn); if (data) fn(data); }
  };

  if (homeList) {
    fetch("/stickers.json", { cache: "no-cache" })
      .then((response) => response.ok ? response.json() : null)
      .then((json) => {
        if (!Array.isArray(json?.items)) return;
        lineStickers = json.items.filter((item) => typeof item?.image === "string").slice(0, 3);
        document.querySelectorAll(".line-visual").forEach((node) => node.replaceChildren(...stickerImages()));
      })
      .catch(() => {});
  }

  const popularity = homeList
    ? fetch("/popularity.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    : Promise.resolve(null);
  fetch(document.body.dataset.appsSrc || "/apps.json")
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((json) => popularity.then((pop) => [json, pop]))
    .then(([json, pop]) => {
      data = json;
      scores = (pop && pop.apps && typeof pop.apps === "object") ? pop.apps : {};
      render();
      if (window.I18n) I18n.onApply(render);
      resolveReady(data);
      if (homeList) loadStats();
    })
    .catch(() => {
      if (homeList) {
        homeList.removeAttribute("aria-busy");
        homeList.hidden = true;
        document.getElementById("works-unavailable").hidden = false;
      }
      resolveReady(null);
    });
})();
