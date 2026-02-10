// app.js — GitHub Pages friendly gallery
// Auto-load by pattern (any ext among png/webp/jpeg/jpg), up to MAX_ITEMS per section,
// skipping missing files, and stopping early after a streak of misses to avoid tons of requests.
//
// Expected filenames in /assets:
//   NFT:     nft-1.webp (or .png/.jpeg/.jpg), nft-2..., ...
//   Mobile:  mob-1.webp (or ...), mob-2..., ...
//   Personal:per-1.webp (or ...), per-2..., ...
//
// Adding a new file like assets/mob-4.webp will automatically add it to Mobile section.

const MAX_ITEMS = 50;
const ASSETS_DIR = "assets/";
const EXTENSIONS = ["webp", "jpg", "jpeg", "png"]; // try fastest/common first

// Stop scanning if we see many missing numbers in a row (reduces requests a lot)
const STOP_AFTER_MISSES = 12;

// Small delay between checks (reduces bursty parallel/network load on Pages)
const CHECK_DELAY_MS = 0;

const SECTIONS = [
    { rootId: "gridNft", prefix: "nft-", titlePrefix: "NFT", defaultType: "Artwork" },
    { rootId: "gridMobile", prefix: "mob-", titlePrefix: "Mobile", defaultType: "Artwork" },
    { rootId: "gridPersonal", prefix: "per-", titlePrefix: "Personal", defaultType: "Artwork" },
];

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

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

// Try to load an image URL (true if it loads)
function tryLoad(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

/**
 * Find first existing url among extensions for baseName (e.g. "mob-4").
 * We do NOT cache-bust here to let CDN/browser cache help on GitHub Pages.
 */
async function findExistingImageUrl(baseName) {
    for (const ext of EXTENSIONS) {
        const url = `${ASSETS_DIR}${baseName}.${ext}`;
        // eslint-disable-next-line no-await-in-loop
        const ok = await tryLoad(url);
        if (ok) return url;

        if (CHECK_DELAY_MS) {
            // eslint-disable-next-line no-await-in-loop
            await sleep(CHECK_DELAY_MS);
        }
    }
    return null;
}

function itemHtml({ title, type, imgUrl }) {
    const t = escapeHtml(title);
    const m = escapeHtml(type);

    return `
    <button class="item" type="button"
      data-title="${t}"
      data-type="${m}"
      data-img="${encodeURI(imgUrl)}">
      <div class="item__media">
        <img class="item__img"
          src="${imgUrl}"
          alt="${t}"
          loading="lazy"
          decoding="async"
          data-fallback="${makePlaceholderSvg(title)}">
      </div>
      <div class="item__body">
        <div class="item__title">${t}</div>
        <div class="item__meta">${m}</div>
      </div>
    </button>
  `;
}

async function buildSection(section) {
    const root = document.getElementById(section.rootId);
    if (!root) return;

    // Optional: tiny loading hint (empty keeps layout clean)
    root.innerHTML = "";

    const found = [];
    let missesInRow = 0;

    for (let idx = 1; idx <= MAX_ITEMS; idx++) {
        const baseName = `${section.prefix}${idx}`;

        // eslint-disable-next-line no-await-in-loop
        const url = await findExistingImageUrl(baseName);

        if (!url) {
            missesInRow++;
            if (missesInRow >= STOP_AFTER_MISSES) break; // stop early
            continue;
        }

        missesInRow = 0;
        found.push({
            title: `${section.titlePrefix} #${idx}`,
            type: section.defaultType,
            imgUrl: url,
        });
    }

    root.innerHTML = found.map(itemHtml).join("");
}

// Fallback if an <img> fails later (e.g. file deleted)
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

// ---------- Init ----------
(async function init() {
    for (const sec of SECTIONS) {
        // eslint-disable-next-line no-await-in-loop
        await buildSection(sec);
    }
})();
