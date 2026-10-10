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
    if (app.visual === "map") {
      return el("div", { class: "map-visual", "aria-hidden": "true" },
        el("span", { class: "map-road r1" }), el("span", { class: "map-road r2" }), el("span", { class: "map-road r3" }),
        el("span", { class: "map-pin p1" }), el("span", { class: "map-pin p2" }), el("span", { class: "map-pin p3" }),
        el("span", { class: "map-me" }));
    }
    return el("div", { class: "generic-visual", "aria-hidden": "true" }, el("span", { text: app.domain || "0x6.ai" }));
  }

  function renderWorks(root) {
    root.innerHTML = "";
    data.apps.filter((a) => a.listed).forEach((app, i) => {
      const href = urlOf(app);
      const tags = (L(app.tags) || []).map((t) => el("span", { class: "tag", text: t }));
      const metrics = (app.metrics || []).map((m) => {
        const v = L(m.value);
        return el("div", { class: "metric" }, el("strong", v === "{COUNT}" ? { id: "workCount", text: "..." } : { text: v }), el("span", { text: L(m.label) }));
      });
      const title = app.heading ? L(app.heading) : app.domain;
      const content = el("div", { class: "work-content" },
        el("div", { class: "tag-row", "aria-hidden": "true" }, tags),
        el("h3", { text: title }),
        el("p", app.visual === "line" ? { id: "workSummary", text: L(app.description) } : { text: L(app.description) }),
        metrics.length ? el("div", { class: "metrics", "aria-hidden": "true" }, metrics) : null,
        el("span", { class: "button primary", text: href ? (L(app.open) || `${ui("open")} ${app.domain}`) : ui("coming") }));
      const cardAttrs = { class: "work-card", "aria-label": `${ui("aria")} ${L(app.name)}`, "data-destination": app.domain };
      const card = href
        ? el("a", Object.assign(cardAttrs, { href, target: "_blank", rel: "noopener" }, app.url === "{LINE}" ? { "data-line-store": "" } : {}), visual(app), content)
        : el("div", cardAttrs, visual(app), content);
      root.append(el("section", { class: "section", id: app.id, "aria-labelledby": `${app.id}-title` },
        el("div", { class: "section-head" }, el("div", {},
          el("div", { class: "eyebrow", text: `${ui("work")} ${app.work}` }),
          el("h2", { id: `${app.id}-title`, text: L(app.name) }))),
        card));
    });
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
      root.append(el("li", {}, appTitle(app), document.createTextNode(lang() === "en" ? ": " : "："), L(app.description)));
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

  fetch("/apps.json")
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((json) => {
      data = json;
      render();
      if (window.I18n) I18n.onApply(render);
      resolveReady(data);
    })
    .catch(() => resolveReady(null));
})();
