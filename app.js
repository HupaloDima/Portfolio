// app.js — FAST gallery via gallery.json + thumb/full
// Grid loads:  assets/thumb/<file>
// Modal loads: assets/full/<file> only on click
//
// Required files:
// - ./gallery.json (in project root)
// - assets/thumb/*.webp
// - assets/full/*.webp
//
// HTML must contain:
// - #gridNft, #gridMobile, #gridPersonal
// - modal elements: #modal, #modalBackdrop, #modalClose, #modalTitle, #modalMeta, #modalImg
// - mobile menu: #burgerBtn, #mobileMenu (optional)

const GALLERY_URL = "./gallery.json";
const THUMB_DIR = "./assets/thumb/";
const FULL_DIR = "./assets/full/";

// How many first NFT items should load ASAP (visible first)
const PRIORITY_FIRST_SECTION_COUNT = 6;

const SECTIONS = [
    { key: "nft", rootId: "gridNft", titlePrefix: "NFT", defaultType: "Artwork" },
    { key: "mobile", rootId: "gridMobile", titlePrefix: "Mobile", defaultType: "Artwork" },
    { key: "personal", rootId: "gridPersonal", titlePrefix: "Personal", defaultType: "Artwork" },
];

function escapeHtml(s) {
    return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function makePlaceholderSvg(title = "Artwork") {
    const safe = escapeHtml(title);
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#0b0f14"/>
          <stop offset="1" stop-color="#111824"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="750" fill="url(#g)"/>
      <rect x="60" y="60" width="1080" height="630" rx="36"
        fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.14)" stroke-width="3"/>
      <g fill="rgba(255,255,255,0.55)" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace">
        <text x="110" y="170" font-size="34">Image not found</text>
        <text x="110" y="225" font-size="22" fill="rgba(255,255,255,0.38)">${safe}</text>
      </g>
    </svg>
  `.trim();
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function itemHtml({ title, type, thumbUrl, fullUrl, priority }) {
    const t = escapeHtml(title);
    const m = escapeHtml(type);

    // priority: first few images in first section
    const loading = priority ? "eager" : "lazy";
    const fetchpriority = priority ? "high" : "auto";

    return `
    <button class="item" type="button"
      data-title="${t}"
      data-type="${m}"
      data-full="${encodeURI(fullUrl)}">
      <div class="item__media">
        <img class="item__img"
          src="${thumbUrl}"
          alt="${t}"
          loading="${loading}"
          decoding="async"
          fetchpriority="${fetchpriority}"
          data-fallback="${makePlaceholderSvg(title)}">
      </div>
      <div class="item__body">
        <div class="item__title">${t}</div>
        <div class="item__meta">${m}</div>
      </div>
    </button>
  `;
}

async function loadGalleryJson() {
    const res = await fetch(GALLERY_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Failed to load gallery.json: ${res.status}`);
    return res.json();
}

function normalizeArray(x) {
    if (!x) return [];
    if (Array.isArray(x)) return x;
    return [];
}

function buildSectionFromList({ rootId, titlePrefix, defaultType }, files, isFirstSection) {
    const root = document.getElementById(rootId);
    if (!root) return;

    const items = files.map((filename, i) => {
        const n = i + 1;
        const title = `${titlePrefix} #${n}`;
        const priority = isFirstSection && i < PRIORITY_FIRST_SECTION_COUNT;

        return itemHtml({
            title,
            type: defaultType,
            thumbUrl: `${THUMB_DIR}${filename}`,
            fullUrl: `${FULL_DIR}${filename}`,
            priority,
        });
    });

    root.innerHTML = items.join("");
}

// Fallback if thumb fails
document.addEventListener(
    "error",
    (e) => {
        const img = e.target;
        if (!(img instanceof HTMLImageElement)) return;
        if (!img.classList.contains("item__img")) return;

        const fb = img.getAttribute("data-fallback");
        if (!fb) return;

        img.onerror = null;
        img.src = fb;
    },
    true
);

// ---------- Modal ----------
const modal = document.getElementById("modal");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalClose = document.getElementById("modalClose");
const modalTitle = document.getElementById("modalTitle");
const modalMeta = document.getElementById("modalMeta");
const modalImg = document.getElementById("modalImg");

function openModal({ title, type, fullUrl }) {
    if (!modal) return;

    modalTitle.textContent = title || "Artwork";
    modalMeta.textContent = type || "";

    // show modal first (fast), then load big image
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    modalImg.alt = title || "Artwork";
    modalImg.src = ""; // reset
    modalImg.onerror = () => {
        modalImg.onerror = null;
        modalImg.src = makePlaceholderSvg(title || "Artwork");
    };
    modalImg.src = fullUrl;
}

function closeModal() {
    if (!modal) return;

    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";

    setTimeout(() => {
        modalImg.src = "";
        modalImg.alt = "";
    }, 120);
}

document.addEventListener("click", (e) => {
    const btn = e.target.closest(".item");
    if (!btn) return;

    const title = btn.dataset.title || "Artwork";
    const type = btn.dataset.type || "";
    const fullUrl = btn.dataset.full ? decodeURI(btn.dataset.full) : "";

    openModal({ title, type, fullUrl });
});

if (modalBackdrop) modalBackdrop.addEventListener("click", closeModal);
if (modalClose) modalClose.addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
});

// ---------- Mobile menu (optional) ----------
const burgerBtn = document.getElementById("burgerBtn");
const mobileMenu = document.getElementById("mobileMenu");

if (burgerBtn && mobileMenu) {
    burgerBtn.addEventListener("click", () => {
        const isOpen = !mobileMenu.hasAttribute("hidden");
        if (isOpen) mobileMenu.setAttribute("hidden", "");
        else mobileMenu.removeAttribute("hidden");
    });

    mobileMenu.addEventListener("click", (e) => {
        if (e.target.tagName === "A") mobileMenu.setAttribute("hidden", "");
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 640) mobileMenu.setAttribute("hidden", "");
    });
}

// ---------- Init ----------
(async function init() {
    try {
        const data = await loadGalleryJson();

        const nft = normalizeArray(data.nft);
        const mobile = normalizeArray(data.mobile);
        const personal = normalizeArray(data.personal);

        // Render in order; first section gets priority loading for first items
        buildSectionFromList(SECTIONS[0], nft, true);
        buildSectionFromList(SECTIONS[1], mobile, false);
        buildSectionFromList(SECTIONS[2], personal, false);
    } catch (err) {
        console.error(err);

        // Basic fallback UI: show nothing but avoid crashing
        const grids = ["gridNft", "gridMobile", "gridPersonal"];
        for (const id of grids) {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML =
                    `<div style="color:rgba(255,255,255,.6);font-family:ui-monospace,Menlo,monospace;padding:12px 0;">
            Failed to load gallery.json. Check file path and GitHub Pages base URL.
          </div>`;
            }
        }
    }
})();
