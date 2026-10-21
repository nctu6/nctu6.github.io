/* 0x6.ai apps: renders works, about, privacy and terms lists from apps.json. */
(function () {
  const LINE_STORE_BASE = "https://store.line.me/stickershop/author/5344394/";
  const UI = {
    "zh-Hant": {
      coming: "即將推出", work: "WORK", dataUse: "資料使用", services: "第三方服務",
      privacy: "隱私權政策", terms: "條款", noServices: "無", open: "打開", aria: "開啟"
    },
    en: {
      coming: "Coming soon", work: "WORK", dataUse: "Data use", services: "Third-party services",
      privacy: "privacy policy", terms: "terms", noServices: "None", open: "Open", aria: "Open"
    }
  };
  const METRO_SVG = `<svg viewBox="0 0 400 230" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 40 H140 L200 100 V210" stroke="#e3002c"/><path d="M20 120 H380" stroke="#0070bd"/><path d="M260 20 V80 L200 140 V170 L150 220" stroke="#008659"/><path d="M80 200 L140 140 H300 L360 80" stroke="#f8b61c"/><path d="M300 140 L360 200 H390" stroke="#c48c31" stroke-dasharray="2 12" opacity="0.45"/><path d="M300 140 V180" stroke="#c48c31" opacity="0.45"/></g><g fill="#fff" stroke="#1f2a24" stroke-width="2.5"><circle cx="60" cy="40" r="4.5"/><circle cx="100" cy="40" r="4.5"/><circle cx="170" cy="70" r="4.5"/><circle cx="60" cy="120" r="4.5"/><circle cx="120" cy="120" r="4.5"/><circle cx="330" cy="120" r="4.5"/><circle cx="260" cy="45" r="4.5"/><circle cx="175" cy="195" r="4.5"/><circle cx="110" cy="170" r="4.5"/><circle cx="340" cy="100" r="4.5"/><circle cx="200" cy="190" r="4.5"/></g><g fill="#fff" stroke="#1f2a24" stroke-width="3"><circle cx="200" cy="120" r="9"/><circle cx="240" cy="120" r="8"/><circle cx="200" cy="140" r="8"/><circle cx="140" cy="40" r="8"/><circle cx="300" cy="140" r="8"/></g><g font-family="ui-monospace, Menlo, monospace" font-size="11" font-weight="700"><rect x="282" y="196" width="104" height="24" rx="5" fill="#1f2a24"/><text x="292" y="212" fill="#85e8be">LAST 24:49</text></g></svg>`;
  let data = null;
  const hooks = [];
  let resolveReady;
  const ready = new Promise((r) => { resolveReady = r; });

  const lang = () => (window.I18n ? I18n.lang : "zh-Hant");
  const L = (v) => (v && typeof v === "object" && !Array.isArray(v) ? (v[lang()] ?? v["zh-Hant"]) : v);
  const ui = (k) => UI[lang()][k] ?? UI["zh-Hant"][k];
  const lineUrl = () => LINE_STORE_BASE + (lang() === "en" ? "en" : "zh-Hant");
  const urlOf = (app) => (app.url === "{LINE}" ? lineUrl() : app.url);

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

  function visual(app) {
    if (app.visual === "x") {
      const post = (short) => el("div", { class: "x-post" }, el("span", { class: "x-avatar" }), el("span", { class: "x-line name" }), el("span", { class: short ? "x-line short" : "x-line" }));
      return el("div", { class: "x-visual", "aria-hidden": "true" },
        el("div", { class: "x-tabs" }, el("span", { text: "News" }), el("span", { text: "AI" }), el("span", { text: "Space" })),
        post(false), post(true), post(false));
    }
    if (app.visual === "line") {
      return el("div", { class: "work-visual", id: "featuredVisual", "aria-hidden": "true" });
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
      return el("div", { class: "cover-visual" },
        el("img", { src: app.image, alt: L(app.imageAlt) || L(app.name), width: "1200", height: "1200", loading: "lazy", decoding: "async" }));
    }
    return el("div", { class: "generic-visual", "aria-hidden": "true" }, el("span", { text: app.domain || "0x6.ai" }));
  }

  function actions(app, href) {
    const main = href ? (L(app.open) || `${ui("open")} ${app.domain}`) : ui("coming");
    if (!app.extra || !app.extra.length) return el("span", { class: "button primary", text: main });
    return el("div", { class: "work-actions" },
      href ? el("a", { class: "button primary", href, target: "_blank", rel: "noopener", text: main }) : el("span", { class: "button primary", text: main }),
      app.extra.map((e) => el("a", { class: "button", href: e.url, target: "_blank", rel: "noopener", text: L(e.label) })));
  }

  /* ---- Works browser: compact tiles + search, tag chips, sort, view, paging, shareable URL ---- */
  const PAGE_SIZE = 24;
  const CHIP_LIMIT = 10;
  const VIEW_KEY = "0x6-works-view";
  const SORTS = ["popular", "newest", "oldest"];
  const state = { q: "", tag: "", sort: "popular", limit: PAGE_SIZE, view: "grid", allTags: false, bound: false };
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
    const pick = (v) => (v && typeof v === "object" && !Array.isArray(v) ? (v[lng] ?? v["zh-Hant"]) : v);
    const fallback = pick(app.description) || "";
    const vars = stats[app.id];
    const tpl = pick(app.descriptionStats);
    if (!vars || typeof tpl !== "string") return fallback;
    let ok = true;
    const out = tpl.replace(/\{(\w+)\}/g, (_, k) => (isCount(vars[k]) ? String(vars[k]) : ((ok = false), "")));
    return ok ? out : fallback;
  }

  function allDescTexts(app) {
    const d = app.description;
    return d && typeof d === "object" && !Array.isArray(d) ? Object.keys(d).map((k) => descText(app, k)) : descText(app);
  }

  function refreshDesc(app) {
    const list = document.getElementById("works-list");
    if (list && state.q.trim()) renderWorks(list); /* search results may change with the new text */
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
    [app.name, app.heading, allDescTexts(app), app.tags, app.domain, app.work].forEach(add);
    (app.extra || []).forEach((e) => add(e.label));
    const s = parts.join("\n").toLowerCase();
    hay.set(app, s);
    return s;
  }

  const score = (app) => {
    const s = scores[app.id] && scores[app.id].score;
    return typeof s === "number" && Number.isFinite(s) ? s : null;
  };

  function sortApps(list) {
    const order = new Map(list.map((a, i) => [a, i])); /* apps.json order = newest first */
    const byAge = (a, b) => (state.sort === "oldest" ? order.get(b) - order.get(a) : order.get(a) - order.get(b));
    return list.slice().sort((a, b) => {
      const pin = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      if (pin) return pin;
      if (state.sort === "popular") {
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
    return new Set(list.filter((a) => !a.pinned && score(a) !== null)
      .sort((a, b) => score(b) - score(a)).slice(0, 3).map((a) => a.id));
  }

  function filtered(list) {
    const terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    return list.filter((a) => (!state.tag || tagKeys(a).includes(state.tag)) && terms.every((t) => haystack(a).includes(t)));
  }

  function tile(app, popular) {
    const href = urlOf(app);
    const name = L(app.name);
    const linkAttrs = { class: "tile-link", href, target: "_blank", rel: "noopener", "data-destination": app.domain, "aria-label": `${ui("aria")} ${name}` };
    if (app.url === "{LINE}") linkAttrs["data-line-store"] = "";
    const title = href ? el("a", linkAttrs, name) : el("span", { class: "tile-link" }, `${name} (${ui("coming")})`);
    return el("article", { class: href ? "work-tile" : "work-tile is-coming", id: app.id },
      el("div", { class: "tile-thumb", "aria-hidden": "true" }, visual(app)),
      el("div", { class: "tile-body" },
        el("div", { class: "tile-meta" },
          el("span", { class: "tile-no", text: `${ui("work")} ${app.work}` }),
          app.pinned ? el("span", { class: "tile-badge pin", text: T("worksPinnedBadge", "Pinned") }) : null,
          popular ? el("span", { class: "tile-badge", text: T("worksPopularBadge", "Popular") }) : null),
        el("h3", { class: "tile-title" }, title),
        el("div", { class: "tile-domain", text: app.domain || "" }),
        el("p", Object.assign({ class: "tile-desc", text: descText(app), "data-desc-for": app.statsApi ? app.id : null }, app.visual === "line" ? { id: "workSummary" } : {})),
        el("div", { class: "tile-foot" },
          el("div", { class: "tile-tags", "aria-hidden": "true" }, (L(app.tags) || []).slice(0, 3).map((t) => el("span", { class: "tag", text: t }))),
          (app.extra || []).map((e) => el("a", { class: "tile-extra", href: e.url, target: "_blank", rel: "noopener", text: `${L(e.label)} ↗` })))));
  }

  function renderChips(list) {
    const root = document.getElementById("works-chips");
    if (!root) return;
    const tags = new Map();
    list.forEach((app) => {
      const labels = L(app.tags) || [];
      tagKeys(app).forEach((k, i) => {
        const t = tags.get(k) || { key: k, label: labels[i] || k, n: 0 };
        t.n += 1;
        tags.set(k, t);
      });
    });
    const all = [...tags.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
    let shown = state.allTags ? all : all.slice(0, CHIP_LIMIT);
    if (state.tag && !shown.some((t) => t.key === state.tag)) shown = shown.concat(all.filter((t) => t.key === state.tag));
    const chip = (key, label, n) => el("button", { type: "button", class: "chip", "data-tag": key, "aria-pressed": String(state.tag === key) },
      label, n ? el("span", { class: "chip-n", text: String(n) }) : null);
    root.innerHTML = "";
    root.append(chip("", T("worksTagAll", "All"), list.length), ...shown.map((t) => chip(t.key, t.label, t.n)));
    if (all.length > CHIP_LIMIT) {
      root.append(el("button", { type: "button", class: "chip chip-more", "data-more": "" },
        state.allTags ? T("worksTagsLess", "Fewer") : fmt(T("worksTagsMore", "+{n} more"), { n: all.length - CHIP_LIMIT })));
    }
  }

  function syncUrl() {
    const p = new URLSearchParams(location.search);
    const set = (k, v) => (v ? p.set(k, v) : p.delete(k));
    set("q", state.q.trim());
    set("tag", state.tag);
    set("sort", state.sort === "popular" ? "" : state.sort);
    const qs = p.toString();
    history.replaceState(null, "", `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`);
  }

  function bindToolbar(root) {
    if (state.bound) return;
    state.bound = true;
    const p = new URLSearchParams(location.search);
    state.q = p.get("q") || "";
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
    document.getElementById("works-chips")?.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-more")) { state.allTags = !state.allTags; rerender(false); return; }
      state.tag = state.tag === b.dataset.tag ? "" : b.dataset.tag;
      rerender();
    });
    document.querySelectorAll(".works-view button").forEach((b) => b.addEventListener("click", () => {
      state.view = b.dataset.view;
      try { localStorage.setItem(VIEW_KEY, state.view); } catch {}
      rerender(false);
    }));
    document.getElementById("works-more")?.addEventListener("click", () => { state.limit += PAGE_SIZE; rerender(false); });
    document.getElementById("works-clear")?.addEventListener("click", () => {
      state.q = ""; state.tag = "";
      if (q) q.value = "";
      rerender();
    });
  }

  function renderWorks(root) {
    bindToolbar(root);
    const all = listedApps();
    const hits = sortApps(filtered(all));
    const popular = topPopular(all);
    const page = hits.slice(0, state.limit);
    root.classList.toggle("is-list", state.view === "list");
    root.innerHTML = "";
    root.append(...page.map((app) => tile(app, popular.has(app.id))));
    renderChips(all);
    document.querySelectorAll(".works-view button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === state.view)));
    const count = document.getElementById("works-count");
    if (count) {
      const active = state.q.trim() || state.tag;
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

  function renderAbout(root) {
    root.innerHTML = "";
    data.apps.filter((a) => a.listed).forEach((app) => {
      root.append(el("li", {}, appTitle(app), document.createTextNode(lang() === "en" ? ": " : "："),
        el("span", { text: descText(app), "data-desc-for": app.statsApi ? app.id : null }),
        (app.extra || []).flatMap((e) => [document.createTextNode(" "), extLink(e.url, L(e.label))])));
    });
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

  function renderCoverage(root) {
    root.innerHTML = "";
    data.apps.forEach((app) => {
      const services = (app.services || []);
      root.append(el("div", { class: "app-entry" },
        el("h3", {}, appTitle(app)),
        el("div", { class: "app-meta", text: app.domain || "" }),
        el("p", { class: "app-label", text: ui("dataUse") }),
        el("ul", {}, (L(app.data) || []).map((d) => el("li", { text: d }))),
        el("p", { class: "app-label", text: ui("services") }),
        services.length ? el("ul", {}, services.map((id) => el("li", {}, serviceLink(id)))) : el("p", { text: ui("noServices") })));
    });
  }

  function renderTerms(root) {
    root.innerHTML = "";
    data.apps.forEach((app) => {
      root.append(el("li", {}, appTitle(app), app.disclaimer ? [document.createTextNode(lang() === "en" ? ": " : "："), L(app.disclaimer)] : []));
    });
  }

  function render() {
    if (!data) return;
    const map = { "works-list": renderWorks, "about-works": renderAbout, "apps-coverage": renderCoverage, "services-list": renderServices, "terms-apps": renderTerms };
    Object.entries(map).forEach(([id, fn]) => { const root = document.getElementById(id); if (root) fn(root); });
    hooks.forEach((fn) => fn(data));
  }

  window.Apps = {
    ready,
    get data() { return data; },
    onRender(fn) { hooks.push(fn); if (data) fn(data); }
  };

  const popularity = document.getElementById("works-list")
    ? fetch("/popularity.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    : Promise.resolve(null);
  fetch("/apps.json")
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((json) => popularity.then((pop) => [json, pop]))
    .then(([json, pop]) => {
      data = json;
      scores = (pop && pop.apps && typeof pop.apps === "object") ? pop.apps : {};
      render();
      if (window.I18n) I18n.onApply(render);
      resolveReady(data);
      loadStats();
    })
    .catch(() => resolveReady(null));
})();
