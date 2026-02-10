// app.js — prioritized loading: first images in first category load ASAP
// Patterns: nft-1.webp ... , mob-1.webp ..., per-1.webp ...
// Missing files are skipped, scan stops after a streak of misses.

const MAX_ITEMS = 50;
const ASSETS_DIR = "assets/";
const EXTENSIONS = ["webp", "jpg", "jpeg", "png"];

const STOP_AFTER_MISSES = 12;

// How many first tiles (in the first section only) should be high priority
const PRIORITY_FIRST_SECTION_COUNT = 6;

const SECTIONS = [
    { rootId: "gridNft", prefix: "nft-", titlePrefix: "NFT", defaultType: "Artwork" },
    { rootId: "gridMobile", prefix: "mob-", titlePrefix: "Mobile", defaultType: "Artwork" },
    { rootId: "gridPersonal", prefix: "per-", titlePrefix: "Personal", defaultType: "Artwork" },
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

function tryLoad(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

async function findExistingImageUrl(baseName) {
    for (const ext of EXTENSIONS) {
        const url = `${ASSETS_DIR}${baseName}.${ext}`;
        // eslint-disable-next-line no-await-in-loop
        const ok = await tryLoad(url);
        if (ok) return url;
    }
    return null;
}

function itemHtml({ title, type, imgUrl, priority }) {
    const t = escapeHtml(title);
    const m = escapeHtml(type);

    const loading = priority ? "eager" : "lazy";
    const fetchpriority = priority ? "high" : "auto";
    const decoding = "async";

    return `
    <button class="item" type="button"
      data-title="${t}"
      data-type="${m}"
      data-img="${encodeURI(imgUrl)}">
      <div class="item__media">
        <img class="item__img"
          src="${imgUrl}"
          alt="${t}"
          loading="${loading}"
          decoding="${decoding}"
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

async function buildSection(section, isFirstSection) {
    const root = document.getElementById(section.rootId);
    if (!root) return;

    const found = [];
    let missesInRow = 0;

    for (let idx = 1; idx <= MAX_ITEMS; idx++) {
        const baseName = `${section.prefix}${idx}`;

        // eslint-disable-next-line no-await-in-loop
        const url = await findExistingImageUrl(baseName);

        if (!url) {
            missesInRow++;
            if (missesInRow >= STOP_AFTER_MISSES) break;
            continue;
        }

        missesInRow = 0;

        const priority =
            isFirstSection && found.length < PRIORITY_FIRST_SECTION_COUNT;

        found.push({
            title: `${section.titlePrefix} #${idx}`,
            type: section.defaultType,
            imgUrl: url,
            priority,
        });
    }

    root.innerHTML = found.map(itemHtml).join("");
}

// Fallback if image fails later
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

function openModal({ title, type, img }) {
    if (!modal) return;

    modalTitle.textContent = title || "Artwork";
    modalMeta.textContent = type || "";

    modalImg.src = img || "";
    modalImg.alt = title || "Artwork";

    modalImg.onerror = () => {
        modalImg.onerror = null;
        modalImg.src = makePlaceholderSvg(title || "Artwork");
    };

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
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

    openModal({
        title: btn.dataset.title || "Artwork",
        type: btn.dataset.type || "",
        img: btn.dataset.img ? decodeURI(btn.dataset.img) : "",
    });
});

if (modalBackdrop) modalBackdrop.addEventListener("click", closeModal);
if (modalClose) modalClose.addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
});

// ---------- Mobile menu ----------
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

// ---------- Init (NFT first, then others) ----------
(async function init() {
    // Build first section (NFT) first with priority tiles
    await buildSection(SECTIONS[0], true);

    // Then build the rest
    for (let i = 1; i < SECTIONS.length; i++) {
        // eslint-disable-next-line no-await-in-loop
        await buildSection(SECTIONS[i], false);
    }
})();
