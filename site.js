/* Shared navigation and policy contents for the static pages. */
(function () {
  const header = document.querySelector(".site-header");
  const menu = document.querySelector("#site-nav");
  const trigger = document.querySelector(".menu-toggle");

  if (header && menu && trigger) {
    const mobile = matchMedia("(max-width: 740px)");
    const updateLabel = () => {
      const open = trigger.getAttribute("aria-expanded") === "true";
      trigger.setAttribute("aria-label", I18n.t(open ? "menuClose" : "menuOpen") || (open ? "關閉選單" : "開啟選單"));
    };
    const setOpen = (open) => {
      header.toggleAttribute("data-menu-open", open);
      trigger.setAttribute("aria-expanded", String(open));
      updateLabel();
    };

    header.setAttribute("data-menu-ready", "");
    trigger.addEventListener("click", () => {
      const open = !header.hasAttribute("data-menu-open");
      setOpen(open);
      if (open) menu.querySelector("a")?.focus();
    });
    menu.addEventListener("click", (event) => {
      if (!mobile.matches || !event.target.closest("a")) return;
      setOpen(false);
      trigger.focus({ preventScroll: true });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !header.hasAttribute("data-menu-open")) return;
      setOpen(false);
      trigger.focus();
    });
    document.addEventListener("click", (event) => {
      if (!header.contains(event.target) && header.hasAttribute("data-menu-open")) setOpen(false);
    });
    mobile.addEventListener("change", () => setOpen(false));
    I18n.onApply(updateLabel);
  }

  const toc = document.getElementById("toc");
  if (toc) {
    const sections = document.querySelectorAll(".document-page .card[id]");
    const buildContents = () => {
      const heading = document.createElement("h2");
      heading.textContent = I18n.t("contentsTitle") || "本頁目錄";
      const links = Array.from(sections, (section) => {
        const link = document.createElement("a");
        link.href = "#" + section.id;
        const number = document.createElement("span");
        number.setAttribute("aria-hidden", "true");
        number.textContent = section.querySelector(".num").textContent;
        link.append(number, section.querySelector("h2").textContent);
        return link;
      });
      toc.replaceChildren(heading, ...links);
      toc.hidden = !links.length;
    };
    buildContents();
    I18n.onApply(buildContents);
  }
})();
