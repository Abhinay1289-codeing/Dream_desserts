/**
 * Digital Menu App — Pure Frontend Logic
 * Works standalone or connected to Supabase backend.
 */

/* ===== CONFIG ===== */
function formatWhatsAppNumber(number) {
    if (!number) return "";
    // Remove any non-digit characters
    const digits = number.replace(/\D/g, "");
    // If it starts with 91 and is 12 digits, use as-is
    if (digits.startsWith("91") && digits.length === 12) {
        return digits;
    }
    // If it's 10 digits, prepend 91 (India country code)
    if (digits.length === 10) {
        return `91${digits}`;
    }
    // Otherwise, return as-is
    return digits;
}

const CONFIG = {
    restaurantName: "Your Restaurant",
    tagline: "Sip, Savour, Smile",
    whatsappPhone: "",   // ← WhatsApp order number
    gstRate: 0.05, // Default 5% rate but disabled
    gstEnabled: false, // Default OFF
    popularItems: [],
    biryanisComingSoon: false,
    chineseComingSoon: false,
    waiterEnabled: true
};

/* ===== MAIN & SUB CATEGORIES ===== */
const MAIN_CATEGORIES = [
    { id: "cafe", label: "Cafe", icon: "☕" },
    { id: "starters", label: "Starters", icon: "🍢" },
    { id: "biryanis", label: "Biryanis", icon: "🍚" },
    { id: "chinese", label: "Chinese", icon: "🍜" }
];

const SUB_CATEGORIES = {
    cafe: [
        { id: "all",               label: "All Cafe",           icon: "🎉", match: null },
        { id: "combo-offers",      label: "Combo Offers",        icon: "🎁", match: ["Combo Offers"] },
        { id: "samosas-momos",     label: "Samosas & Momos",     icon: "🥟", match: ["Samosas & Momos"] },
        { id: "teas",              label: "Teas",           icon: "🍵", match: ["Teas"] },
        { id: "hot-beverages",     label: "Hot Beverages",      icon: "☕", match: ["Hot Beverages"] },
        { id: "hot-brews",         label: "Hot Brews",          icon: "☕", match: ["Hot Brews"] },
        { id: "cold-brews",        label: "Cold Brews",         icon: "🧊", match: ["Cold Brews"] },
        { id: "blended-brews",     label: "Blended Brews",       icon: "🥤", match: ["Blended Brews"] },
        { id: "milk-shakes",       label: "Milk Shakes",         icon: "🍦", match: ["Milk Shakes"] },
        { id: "soft-drinks",       label: "Soft Drinks",         icon: "🥤", match: ["Soft Drinks"] },
        { id: "mocktails",         label: "Mocktails",          icon: "🍹", match: ["Mocktails"] },
        { id: "lassis",            label: "Lassis",             icon: "🥛", match: ["Lassis"] },
        { id: "omelettes",         label: "Omelettes",           icon: "🍳", match: ["Omelettes"] },
        { id: "maggi",              label: "Maggi",               icon: "🍜", match: ["Maggi"] },
        { id: "sandwiches",        label: "Sandwiches",          icon: "🥪", match: ["Sandwiches"] },
        { id: "waffles-pancakes",  label: "Waffles & Pancakes",  icon: "🧇", match: ["Waffles & Pancakes"] },
        { id: "fried-food-quick",  label: "Fried Food & Quick Bites", icon: "🍟", match: ["Fried Food & Quick Bites"] },
        { id: "fried-chicken-fish",label: "Fried Chicken & Fish", icon: "🍗", match: ["Fried Chicken & Fish"] },
        { id: "rolls",            label: "Rolls",               icon: "🌯", match: ["Rolls"] },
        { id: "pasta",            label: "Pasta",               icon: "🍝", match: ["Pasta"] },
        { id: "pizzas",           label: "Pizzas",              icon: "🍕", match: ["Pizzas"] },
        { id: "burgers",          label: "Burgers",             icon: "🍔", match: ["Burgers"] },
        { id: "desserts-ice-creams",label: "Desserts & Ice Creams", icon: "🍨", match: ["Desserts & Ice Creams"] }
    ],
    starters: [
        { id: "all-starters",    label: "All Starters",      icon: "🎉", match: null },
        { id: "veg-starters",    label: "Veg Starters",      icon: "🥬", match: ["Veg Starters"] },
        { id: "nonveg-starters", label: "Non-Veg Starters",  icon: "🍗", match: ["Starters"] }
    ],
    biryanis: [
        { id: "all-biryani",     label: "All Biryanis",     icon: "🎉", match: null },
        { id: "nonveg-biryani",  label: "Non-Veg Biryanis", icon: "🍗", match: ["Biryanis"] },
        { id: "veg-biryani",     label: "Veg Biryanis",     icon: "🥬", match: ["Veg Biryanis"] }
    ],
    chinese: [
        { id: "all-chinese", label: "All Chinese & Mains", icon: "🎉", match: null },
        { id: "starters", label: "Non-Veg Starters", icon: "🍗", match: ["Starters", "Chinese"] },
        { id: "veg-starters", label: "Veg Starters", icon: "🥬", match: ["Veg Starters"] },
        { id: "soups", label: "Soups", icon: "🍲", match: ["Soups"] },
        { id: "fried-rice", label: "Fried Rice", icon: "🍚", match: ["Fried Rice", "Veg Fried Rice"] },
        { id: "rice", label: "Rice", icon: "🍛", match: ["Rice"] }
    ]
};

/* ===== CATEGORIES flat list (used by admin-app.js) ===== */
// Flat array of every sub-category across all main categories
const CATEGORIES = Object.values(SUB_CATEGORIES).flat();
window.CATEGORIES = CATEGORIES; // expose for admin-app.js

/* ===== STATE ===== */
let activeMainCategory = "cafe";
let activeSubCategory = "all";
let cart = [];
let searchTerm = "";
let modalItem = null;
let modalQty = 1;
let menuItemsCache = [];
let categoryOverrides = {};
let hasAttemptedSupabaseLoad = false;

/* ===== VARIANT PICKER ===== */
let pendingVariantItem = null;
let pendingVariantBtnEl = null;

/**
 * Detects items with choices like "(Steamed/Fried)" or "(Sweet / Salt)".
 * Returns { options: string[], label: string } or null.
 */
function parseVariants(name) {
    // Match any parenthesised group that contains a "/"
    const match = name.match(/\(([^)]+\/[^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split('/').map(s => s.trim()).filter(Boolean);
    return parts.length >= 2 ? { options: parts, label: match[0] } : null;
}

function openVariantPicker(item, btnEl) {
    const variants = parseVariants(item.name);
    if (!variants) {
        // No variant — add directly
        addToCart(item, 1, btnEl);
        return;
    }
    pendingVariantItem = item;
    pendingVariantBtnEl = btnEl;

    // Build clean title without the variant group
    const cleanName = item.name.replace(variants.label, '').trim().replace(/\s{2,}/g, ' ');
    const titleEl = $("variantModalTitle");
    if (titleEl) titleEl.textContent = cleanName || item.name;

    const optsEl = $("variantOptions");
    if (optsEl) {
        // Emoji map for common options
        const iconMap = {
            steamed: '♨️', fried: '🍳', sweet: '🍬', salt: '🧂', salted: '🧂',
            spicy: '🌶️', mild: '😊', veg: '🥬', nonveg: '🍗'
        };
        optsEl.innerHTML = variants.options.map(opt => {
            const icon = iconMap[opt.toLowerCase()] || '✅';
            return `<button type="button" class="variant-option-btn" data-variant="${esc(opt)}">${icon} ${esc(opt)}</button>`;
        }).join('');
        optsEl.querySelectorAll('.variant-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const chosen = btn.dataset.variant;
                addToCartWithVariant(pendingVariantItem, chosen, 1, pendingVariantBtnEl);
                closeVariantPicker();
            });
        });
    }

    const modal = $("variantModal");
    modal?.classList.add('open');
    modal?.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeVariantPicker() {
    const modal = $("variantModal");
    modal?.classList.remove('open');
    modal?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    pendingVariantItem = null;
    pendingVariantBtnEl = null;
}

function addToCartWithVariant(item, variant, qty = 1, btnEl = null) {
    const variants = parseVariants(item.name);
    // Build the display name substituting the variant group
    const displayName = variants
        ? item.name.replace(variants.label, `(${variant})`).replace(/\s{2,}/g, ' ').trim()
        : item.name;

    const ex = cart.find(c => c.name === displayName);
    if (ex) ex.qty += qty;
    else cart.push({ ...item, name: displayName, original_name: item.name, qty, notes: '' });

    updateCartUI();
    if (btnEl) flyToCart(item.image, btnEl);
    const fc = $("floatCart");
    fc?.classList.remove("pulse-once");
    void fc?.offsetWidth;
    fc?.classList.add("pulse-once");
    const hc = $("headerCartBtn");
    hc?.classList.remove("bump");
    void hc?.offsetWidth;
    hc?.classList.add("bump");
    setTimeout(() => hc?.classList.remove("bump"), 500);
    showToast(`✅ Added ${displayName}`);
}

/* ===== COMING SOON ENABLED ITEMS (persisted in localStorage) ===== */
let enabledComingSoonItems = new Set(
    JSON.parse(localStorage.getItem('cafeEnabledComingSoon') || '[]')
);

function saveEnabledComingSoon() {
    localStorage.setItem('cafeEnabledComingSoon', JSON.stringify([...enabledComingSoonItems]));
}

function enableComingSoonItem(itemName) {
    enabledComingSoonItems.add(itemName);
    saveEnabledComingSoon();
    renderMenu();
    showToast(`✅ ${itemName} is now available to order!`);
}

function enableAllComingSoonInCategory(category) {
    const items = getItems().filter(i => i.category === category && isCategoryComingSoon(i.category));
    items.forEach(i => enabledComingSoonItems.add(i.name));
    saveEnabledComingSoon();
    renderMenu();
    showToast(`✅ All ${category} items enabled for ordering!`);
}

/* ===== TABLE (from URL QR) ===== */
const urlParams = new URLSearchParams(window.location.search);
const urlTable = urlParams.get("table");
if (urlTable) sessionStorage.setItem("cafeTable", urlTable.trim().replace(/^#/, ""));

function getTableNumber() {
    return (sessionStorage.getItem("cafeTable") || urlTable || "").trim().replace(/^#/, "");
}

function formatTableHash(n) {
    const t = getTableNumber();
    return t ? `#${t}` : "";
}

/* ===== HELPERS ===== */
function $(id) { return document.getElementById(id); }

function esc(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");
}

function showToast(msg, isError = false) {
    const c = $("toastContainer");
    if (!c) return;
    const t = document.createElement("div");
    t.className = "toast" + (isError ? " error" : "");
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 2800);
}

// Items whose names don't contain obvious non-veg keywords but are still non-veg
const NON_VEG_OVERRIDES = new Set([
    "banana leaf biryani",
    "mutton biryani",
    "mutton fry piece biryani",
    "mixed biryani",
    "mixed mughlai biryani",
    "pot biryani",
    "kheema biryani",
    "house special biryani",
    "8 to 8 chicken",
    "house special (chicken)",
    "mutton 65",
    "mutton manchurian",
    "chilli mutton",
    "mutton roast",
    "pepper mutton",
    "sezwan mutton",
    "mutton fried rice",
    "spl mutton fried rice",
    "spl house special fried rice",
    "sambar rice with chicken fry"
]);

function isVeg(item) {
    const n = (item.name || "").toLowerCase().trim();
    if (n.includes("banana leaf") || NON_VEG_OVERRIDES.has(n)) return false;
    return !(n.includes("chicken") || n.includes("mutton") || n.includes("fish") || n.includes("egg") || n.includes("pepperoni") || n.includes("kheema") || n.includes("keema") || n.includes("prawn") || n.includes("shrimp"));
}

const INGREDIENT_MAP = {
    "Hot Coffee": "Freshly brewed espresso, steamed milk, froth",
    "Cold Coffee": "Chilled coffee brew, milk, ice, sweetener",
    "Tea & Infusions": "Premium tea leaves, hot water, milk or herbs",
    "Sandwiches & Paninis": "Grilled bread, fresh veggies or chicken, cheese, house spreads",
    "Pasta & Pizza": "Durum wheat pasta, hand-tossed crust, rich sauces, mozzarella",
    "Sides & Snacks": "Crispy golden sides, house seasoning, dipping sauces",
    "Desserts": "Baked fresh daily, premium chocolates, creams",
    "Combo Offers": "Curated value combo with popular food and drink pairings"
};

function enrichItem(item) {
    const local = (typeof menuData !== 'undefined' && menuData.restaurant) ? menuData.restaurant.find(l => l.name === item.name) : null;
    const imgSrc = (item.image && item.image.trim() !== '') ? item.image : (local?.image || 'assets/images/placeholder.webp');
    const hash = item.name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return {
        ...item,
        image: imgSrc,
        isVeg: isVeg(item),
        description: item.description?.trim()
            ? item.description
            : `Fresh ${item.category.toLowerCase()} · made to order`,
        ingredients: INGREDIENT_MAP[item.category] || "Fresh ingredients · house recipe",
        rating: (4.2 + (hash % 8) / 10).toFixed(1),
        reviews: 40 + (hash % 180),
        prepTime: "15–20 min",
        popular: CONFIG.popularItems.some(p => item.name.includes(p) || p.includes(item.name))
    };
}

function getItems() {
  if (menuItemsCache.length > 0) {
    return menuItemsCache.map(item => ({
      ...enrichItem(item),
      category: categoryOverrides[item.category] || item.category
    }));
  }
  return (menuData.restaurant || []).map(enrichItem);
}

async function loadDataFromSupabase() {
  hasAttemptedSupabaseLoad = true;
  if (!window.sb) return;

  try {
    const [menuItems, configData, catOverrides] = await Promise.all([
      sbGetMenuItems(),
      sbGetConfig(),
      sbGetCategoryOverrides()
    ]);

    if (menuItems && menuItems.length > 0) {
      // Image priority:
      //  1. If admin updated the image in Supabase (data URL or non-Unsplash URL) → use Supabase
      //  2. Otherwise (still the default Unsplash URL or empty) → use local assets from menu-data.js
      const localImageMap = {};
      (menuData.restaurant || []).forEach(item => { localImageMap[item.name] = item.image; });
      menuItemsCache = menuItems
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(item => {
          const dbImg = item.image || '';
          const localImg = localImageMap[item.name] || '';
          // Use base64 data URLs from DB if admin manually uploaded, otherwise use localImg asset
          const isUploadedDataUrl = dbImg.startsWith('data:');
          const finalImg = isUploadedDataUrl ? dbImg : (localImg || dbImg);
          return { ...item, image: finalImg };
        });
    }

    if (configData) {
      Object.assign(CONFIG, configData);
    }

    if (catOverrides) {
      categoryOverrides = catOverrides;
    }

    renderMainCategories();
    renderSubCategories();
    renderMenu();
    applyBrand();
  } catch (e) {
    console.error("Failed to load from Supabase:", e);
  }
}

function addCacheBuster(url) {
  return url;
}

function applyBrand() {
  // Update hero background
  const heroBgImg = document.querySelector(".hero-clean-bg img");
  if (heroBgImg && CONFIG.heroBg) {
    heroBgImg.src = addCacheBuster(CONFIG.heroBg);
  }

  // Update hero tagline
  const welcomeTagline = document.getElementById('welcomeTagline');
  const heroTagline = document.getElementById('heroTagline');
  if (welcomeTagline) welcomeTagline.textContent = CONFIG.tagline || 'Sip, Savour, Smile';
  if (heroTagline) heroTagline.textContent = CONFIG.tagline || 'Sip, Savour, Smile';

  // Show/hide waiter help button
  const waiterFab = document.getElementById('waiterFab');
  if (waiterFab) {
    waiterFab.style.display = (CONFIG.waiterEnabled !== false) ? 'flex' : 'none';
  }

  // Apply custom theme color if set
  const customColor = localStorage.getItem('cafeCustomThemeColor');
  if (customColor) {
    applyCustomThemeColor(customColor);
  }
}

function applyCustomThemeColor(hexColor) {
  document.documentElement.style.setProperty('--primary', hexColor);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.content = hexColor;
}

const CHINESE_PRIORITY = ["8 to 8 Chicken", "Pepper Chicken", "Chilli Chicken", "Schezwan Chicken", "Chicken Lollipops (6 Pcs) (Dry/Wet)", "Chicken 65", "Chicken Roast"];

function sortChinesePriority(list) {
    const priority = new Map(CHINESE_PRIORITY.map((name, i) => [name, i]));
    return [...list].sort((a, b) => {
        const pa = priority.has(a.name) ? priority.get(a.name) : 999;
        const pb = priority.has(b.name) ? priority.get(b.name) : 999;
        if (pa !== pb) return pa - pb;
        return (a.sort_order || 0) - (b.sort_order || 0);
    });
}

function filterItems(items) {
    let list = items;
    // First filter by main category
    if (activeMainCategory === "cafe") {
        const chineseCats = ["Chinese", "Starters", "Veg Starters", "Soups", "Fried Rice", "Veg Fried Rice", "Rice", "Biryanis", "Veg Biryanis"];
        list = list.filter(i => !chineseCats.includes(i.category));
    } else if (activeMainCategory === "starters") {
        list = list.filter(i => i.category === "Starters" || i.category === "Veg Starters");
    } else if (activeMainCategory === "biryanis") {
        list = list.filter(i => i.category === "Biryanis" || i.category === "Veg Biryanis");
    } else if (activeMainCategory === "chinese") {
        const chineseCats = ["Chinese", "Starters", "Veg Starters", "Soups", "Fried Rice", "Veg Fried Rice", "Rice"];
        list = list.filter(i => chineseCats.includes(i.category));
    }

    // Then filter by sub-category
    const subs = SUB_CATEGORIES[activeMainCategory];
    const subCat = subs.find(c => c.id === activeSubCategory);
    if (subCat && subCat.match) {
        list = list.filter(i => subCat.match.includes(i.category));
    }

    if (searchTerm) {
        const q = searchTerm.toLowerCase();
        list = list.filter(i =>
            i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
        );
    }
    if (activeMainCategory === "chinese") {
        list = sortChinesePriority(list);
    }
    return list;
}

function getPopularItems() {
    // Always search the full local menu + Supabase cache merged
    // so popular items are found regardless of which source is active
    const localItems = (menuData.restaurant || []).map(enrichItem);
    const dbItems = menuItemsCache.length > 0 ? menuItemsCache.map(enrichItem) : [];

    // Merge: prefer Supabase item if name matches, else use local
    const allByName = new Map();
    localItems.forEach(i => allByName.set(i.name, i));
    dbItems.forEach(i => allByName.set(i.name, i)); // db wins on conflict

    const picked = [];
    CONFIG.popularItems.forEach(name => {
        const item = allByName.get(name);
        if (item && !picked.some(p => p.name === item.name)) picked.push(item);
    });
    return picked;
}

/* ===== WELCOME SPLASH ===== */
function initWelcome() {
    const splash = $("welcomeSplash");
    const shell = $("appShell");
    const particles = $("welcomeParticles");
    const sparks = $("welcomeSparks");

    if (particles) {
        for (let i = 0; i < 10; i++) {
            const p = document.createElement("span");
            p.className = "welcome-particle";
            p.style.top = 15 + Math.random() * 70 + "%";
            p.style.left = i % 2 === 0 ? "-5%" : "105%";
            p.style.setProperty("--from-x", i % 2 === 0 ? "70vw" : "-70vw");
            p.style.animationDelay = i * 0.1 + "s";
            particles.appendChild(p);
        }
    }

    if (sparks) {
        for (let i = 0; i < 12; i++) {
            const s = document.createElement("span");
            s.className = "welcome-spark";
            s.style.left = Math.random() * 100 + "%";
            s.style.top = Math.random() * 100 + "%";
            s.style.animationDelay = 0.3 + Math.random() * 1.2 + "s";
            sparks.appendChild(s);
        }
    }

    const dismissWelcome = () => {
        splash?.classList.add("is-done");
        shell?.classList.remove("is-welcome");
        shell?.classList.add("is-ready");
        splash?.setAttribute("aria-hidden", "true");
    };

    splash?.addEventListener("click", dismissWelcome);
    setTimeout(dismissWelcome, 2200);
}

/* ===== HEADER ===== */
function initHeader() {
    const header = $("mainHeader");
    window.addEventListener("scroll", () => {
        header?.classList.toggle("is-scrolled", window.scrollY > 20);
    }, { passive: true });

    $("themeToggle")?.addEventListener("click", () => {
        const html = document.documentElement;
        const next = html.dataset.theme === "dark" ? "light" : "dark";
        html.dataset.theme = next;
        $("themeToggle").textContent = next === "dark" ? "🌙" : "☀️";
        localStorage.setItem("cafeTheme", next);
        updateThemeMeta(next);
    });

    const saved = localStorage.getItem("cafeTheme");
    if (saved) {
        document.documentElement.dataset.theme = saved;
        if ($("themeToggle")) $("themeToggle").textContent = saved === "dark" ? "🌙" : "☀️";
        updateThemeMeta(saved);
    }

    $("searchInput")?.addEventListener("input", e => {
        searchTerm = e.target.value;
        renderMenu();
        if (searchTerm.trim()) {
            setTimeout(() => {
                const menuGrid = $("menuGrid");
                const headerH = header?.offsetHeight || 0;
                if (menuGrid) {
                    const top = menuGrid.getBoundingClientRect().top + window.scrollY - headerH - 12;
                    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
                }
            }, 150);
        }
    });

    $("headerCartBtn")?.addEventListener("click", openCart);
    $("floatCartBtn")?.addEventListener("click", openCart);

    // Parallax hero
    const heroBg = document.querySelector(".hero-clean-bg img");
    window.addEventListener("scroll", () => {
        if (!heroBg) return;
        const y = Math.min(window.scrollY * 0.2, 40);
        heroBg.style.transform = `scale(1.08) translateY(${y * 0.3}px)`;
    }, { passive: true });

    updateTableUI();
}

function updateThemeMeta(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "light" ? "#d32f2f" : "#0c0c0c";
}

function updateTableUI() {
    const hash = formatTableHash(getTableNumber());
    const has = Boolean(hash);
    document.body.classList.toggle("has-table", has);
    ["navTableBadge", "cartTableLine"].forEach(id => {
        const el = $(id);
        if (el) el.classList.toggle("is-hidden", !has);
    });
    if ($("tableLabel") && has) $("tableLabel").textContent = `Table ${hash}`;
    if ($("cartTableLine") && has) $("cartTableLine").textContent = `Ordering from Table ${hash}`;
}

/* ===== CATEGORIES ===== */
function renderMainCategories() {
    const nav = $("categoryNav");
    if (!nav) return;
    nav.innerHTML = MAIN_CATEGORIES.map(c => {
      return `<button type="button" class="cat-pill${c.id === activeMainCategory ? " active" : ""}" data-main-cat="${c.id}">${c.icon || ""} ${c.label}</button>`;
    }).join("");
    nav.querySelectorAll(".cat-pill").forEach(p => {
        p.addEventListener("click", () => {
            activeMainCategory = p.dataset.mainCat;
            // Reset sub-category to "all" when switching main category
            const subs = SUB_CATEGORIES[activeMainCategory];
            activeSubCategory = subs[0].id;
            renderMainCategories();
            renderSubCategories();
            renderMenu();
            p.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
            setTimeout(() => {
                const menuGrid = $("menuGrid");
                const navBar = document.querySelector(".category-nav");
                if (!menuGrid) return;
                const offset = (navBar?.offsetHeight || 0) + 8;
                const top = menuGrid.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
            }, 150);
        });
    });
}

function renderSubCategories() {
    const subNav = document.getElementById("subCategoryNav");
    if (!subNav) return;
    const subs = SUB_CATEGORIES[activeMainCategory];
    subNav.innerHTML = subs.map(c => {
        const label = categoryOverrides[c.label] || c.label;
        return `<button type="button" class="cat-pill${c.id === activeSubCategory ? " active" : ""}" data-sub-cat="${c.id}">${c.icon || ""} ${label}</button>`;
    }).join("");
    subNav.querySelectorAll(".cat-pill").forEach(p => {
        p.addEventListener("click", () => {
            activeSubCategory = p.dataset.subCat;
            renderSubCategories();
            renderMenu();
            p.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        });
    });
}

/* ===== CATEGORIES COMBINED (used by admin-app.js) ===== */
function renderCategories() {
    renderMainCategories();
    renderSubCategories();
}
// Expose globally so admin-app.js can override it
window.renderCategories = renderCategories;

/* ===== MENU RENDER ===== */
function showSkeleton(show) {
    $("menuSkeleton")?.classList.toggle("is-hidden", !show);
    $("menuGrid")?.classList.toggle("is-hidden", show);
    if (show && $("menuSkeleton")) {
        $("menuSkeleton").innerHTML = Array(6).fill('<div class="skeleton-card"></div>').join("");
    }
}

function isCategoryComingSoon(category) {
    return (category === "Biryanis" && CONFIG.biryanisComingSoon) || 
           (category === "Chinese" && CONFIG.chineseComingSoon);
}

function isOrderableItem(itemName) {
    return itemName === "Chicken Fry Piece Biryani" || itemName === "Chicken Dum Biryani" ||
           itemName === "Banana Leaf Biryani" ||
           itemName === "Chicken Moghalai Biryani" || itemName === "Chicken Lollipop Biryani" ||
           itemName === "Boneless Chicken Biryani" ||
           itemName === "Mutton Fry Piece Biryani" ||
           itemName === "Mushroom Biryani" || itemName === "Paneer Biryani" ||
           itemName === "Pepper Chicken" || itemName === "8 to 8 Chicken" ||
           itemName === "Chicken Lollipops (6 Pcs) (Dry/Wet)" ||
           itemName === "Chilli Chicken" || itemName === "Schezwan Chicken" ||
           itemName === "Chicken 65" || itemName === "Chicken Roast" ||
           enabledComingSoonItems.has(itemName);
}

function buildCard(item, i) {
    const inCart = cart.find(c => c.name === item.name || c.original_name === item.name);
    const avail = item.available !== false;
    const comingSoon = isCategoryComingSoon(item.category) && !isOrderableItem(item.name);
    const btnLabel = comingSoon ? "Coming Soon" : !avail ? "Not Available" : inCart ? `In Cart (${inCart.qty})` : "Add";
    const btnClass = comingSoon ? "add-btn unavailable-btn" : !avail ? "add-btn unavailable-btn" : inCart ? "add-btn in-cart" : "add-btn";
    return `
    <article class="food-card${!avail ? ' food-card--unavailable' : ''}${comingSoon ? ' food-card--coming-soon' : ''}" data-name="${esc(item.name)}" style="--i:${i}">
        <div class="food-card-img">
            <img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" data-src="${addCacheBuster(item.image)}" alt="${esc(item.name)}" loading="lazy" decoding="async" class="lazy-img">
            ${item.popular && avail && !comingSoon ? '<span class="food-card-badge">Popular</span>' : ''}
            ${comingSoon ? '<span class="food-card-badge coming-soon-badge">Coming Soon</span>' : ''}
            ${!avail ? '<span class="food-card-badge unavailable-badge">Unavailable</span>' : ''}
            <span class="veg-indicator ${item.isVeg ? 'veg' : 'nonveg'}"></span>
        </div>
        <div class="food-card-body">
            <div>
                <h3 class="food-card-name">${esc(item.name)}</h3>
                <p class="food-card-desc">${esc(item.description)}</p>
                <div class="food-card-meta"><span>⭐ ${item.rating}</span><span>· ${item.prepTime}</span></div>
            </div>
            <div class="food-card-foot">
                ${!comingSoon ? `<span class="food-card-price">₹${item.price}</span>` : '<span class="food-card-price coming-soon-price">Price TBA</span>'}
                <button type="button" class="${btnClass}" data-add="${esc(item.name)}" ${comingSoon || !avail ? 'disabled' : ''}>${btnLabel}</button>
            </div>
        </div>
    </article>`;
}

function renderMenu() {
    showSkeleton(true);
    setTimeout(() => {
        const items = filterItems(getItems());
        const grid = $("menuGrid");
        const empty = $("menuEmpty");
        if (!grid) return;

        if (!items.length) {
            grid.innerHTML = "";
            empty?.classList.remove("is-hidden");
            showSkeleton(false);
            return;
        }
        empty?.classList.add("is-hidden");

        let html = "";
        let idx = 0;

        items.forEach(item => { html += buildCard(item, idx++); });

        grid.innerHTML = html;
        bindCardEvents(grid);
        showSkeleton(false);
        syncAddButtons();
        renderAlsoBuy();
    }, 100);
}

function renderAlsoBuy() {
    const section = $("alsoBuySection");
    const track = $("alsoBuyTrack");
    if (!section || !track) return;

    if (searchTerm) { section.classList.add("is-hidden"); return; }

    const popular = getPopularItems().filter(item => !isCategoryComingSoon(item.category) || isOrderableItem(item.name));
    if (!popular.length) { section.classList.add("is-hidden"); return; }

    section.classList.remove("is-hidden");
    track.innerHTML = popular.map(item => {
        const inCart = cart.find(c => c.name === item.name || c.original_name === item.name);
        const local = (typeof menuData !== 'undefined' && menuData.restaurant) ? menuData.restaurant.find(l => l.name === item.name) : null;
        const imgSrc = (item.image && item.image.trim() !== '') ? item.image : (local?.image || 'assets/images/placeholder.webp');
        return `
        <article class="also-buy-chip" data-name="${esc(item.name)}">
            <img src="${addCacheBuster(imgSrc)}" alt="${esc(item.name)}" loading="lazy" decoding="async" class="also-buy-img" onerror="this.onerror=null;this.src='assets/images/placeholder.webp';">
            <div class="also-buy-chip-body">
                <h3>${esc(item.name)}</h3>
                <p>₹${item.price} · ⭐ ${item.rating}</p>
            </div>
            <button type="button" class="also-buy-add${inCart ? ' in-cart' : ''}" data-add="${esc(item.name)}" aria-label="Add ${esc(item.name)}">${inCart ? '✓' : '+'}</button>
        </article>`;
    }).join("");

    track.querySelectorAll(".also-buy-chip").forEach(chip => {
        chip.addEventListener("click", e => {
            if (e.target.closest(".also-buy-add")) return;
            const item = getItems().find(i => i.name === chip.dataset.name);
            if (item) openFoodModal(item);
        });
    });
    track.querySelectorAll(".also-buy-add").forEach(btn => {
        btn.addEventListener("click", e => {
            e.stopPropagation();
            const item = getItems().find(i => i.name === btn.dataset.add);
            if (item) openVariantPicker(item, btn);
        });
    });
}

function bindCardEvents(grid) {
    if ('IntersectionObserver' in window) {
        const imgObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                    }
                    observer.unobserve(img);
                }
            });
        }, { rootMargin: '150px 0px' });
        
        document.querySelectorAll('.lazy-img').forEach(img => {
            if (img.dataset.src) imgObserver.observe(img);
        });
    }

    grid.querySelectorAll(".food-card").forEach(card => {
        card.addEventListener("click", e => {
            if (e.target.closest(".add-btn")) return;
            const item = getItems().find(i => i.name === card.dataset.name);
            if (!item) return;
            if (item.available === false) {
                showToast("⛔ Item currently unavailable", true);
                return;
            }
            if (isCategoryComingSoon(item.category) && !isOrderableItem(item.name)) {
                showToast("⏳ This item is coming soon!", true);
                return;
            }
            openFoodModal(item);
        });
    });
    grid.querySelectorAll(".add-btn").forEach(btn => {
        btn.addEventListener("click", e => {
            e.stopPropagation();
            if (btn.disabled) return;
            const item = getItems().find(i => i.name === btn.dataset.add);
            if (!item) return;
            if (isCategoryComingSoon(item.category) && !isOrderableItem(item.name)) {
                showToast("⏳ This item is coming soon!", true);
                return;
            }
            // Check if item already in cart (any variant)
            const inCartExact = cart.find(c => c.name === item.name);
            const hasVariants = parseVariants(item.name);
            if (!hasVariants && inCartExact) {
                openCart();
            } else {
                openVariantPicker(item, btn);
            }
        });
    });
}

function syncAddButtons() {
    document.querySelectorAll(".add-btn[data-add]").forEach(btn => {
        const ex = cart.find(c => c.name === btn.dataset.add || c.original_name === btn.dataset.add);
        btn.textContent = ex ? `In Cart (${ex.qty})` : "Add";
        btn.classList.toggle("in-cart", Boolean(ex));
    });
}

/* ===== FLY TO CART ===== */
function flyToCart(imgSrc, fromEl) {
    const target = $("headerCartBtn") || $("floatCartBtn");
    if (!fromEl || !target) return;
    const fly = document.createElement("img");
    fly.className = "fly-img";
    fly.src = imgSrc;
    const r1 = fromEl.getBoundingClientRect();
    const r2 = target.getBoundingClientRect();
    fly.style.cssText = `position:fixed;width:48px;height:48px;border-radius:50%;object-fit:cover;z-index:9000;transition:all 0.65s cubic-bezier(.22,1,.36,1);`;
    fly.style.left = r1.left + r1.width / 2 - 24 + "px";
    fly.style.top = r1.top + "px";
    $("flyLayer")?.appendChild(fly);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            fly.style.left = r2.left + r2.width / 2 - 12 + "px";
            fly.style.top = r2.top + r2.height / 2 - 12 + "px";
            fly.style.width = "24px";
            fly.style.height = "24px";
            fly.style.opacity = "0.4";
        });
    });
    setTimeout(() => fly.remove(), 700);
}

/* ===== CART ===== */
function addToCart(item, qty = 1, btnEl = null) {
    const ex = cart.find(c => c.name === item.name);
    if (ex) ex.qty += qty;
    else cart.push({ ...item, qty, notes: "" });
    updateCartUI();
    if (btnEl) flyToCart(item.image, btnEl);
    const fc = $("floatCart");
    fc?.classList.remove("pulse-once");
    void fc?.offsetWidth;
    fc?.classList.add("pulse-once");
    const hc = $("headerCartBtn");
    hc?.classList.remove("bump");
    void hc?.offsetWidth;
    hc?.classList.add("bump");
    setTimeout(() => hc?.classList.remove("bump"), 500);
    showToast(`✅ Added ${item.name}`);
}

function changeQty(name, delta) {
    const item = cart.find(c => c.name === name);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) cart = cart.filter(c => c.name !== name);
    updateCartUI();
}

function removeFromCart(name) {
    cart = cart.filter(c => c.name !== name);
    updateCartUI();
}

function updateCartUI() {
    let count = 0, subtotal = 0;
    cart.forEach(i => { count += i.qty; subtotal += i.price * i.qty; });
    
    let total = subtotal;
    let gst = 0;
    
    // Update cart summary elements (if they exist)
    const cartSubtotalEl = $("cartSubtotal");
    const cartGstLineEl = $("cartGstLine");
    const cartGstEl = $("cartGst");
    const cartTotalEl = $("cartTotal");
    
    if (cartSubtotalEl) cartSubtotalEl.textContent = subtotal;
    
    if (CONFIG.gstEnabled) {
        gst = Math.round(subtotal * CONFIG.gstRate);
        total = subtotal + gst;
        const gstPercent = Math.round(CONFIG.gstRate * 100);
        if (cartGstLineEl) {
            cartGstLineEl.style.display = "flex";
            cartGstLineEl.innerHTML = `<span>GST (${gstPercent}%)</span><span>₹<span id="cartGst">${gst}</span></span>`;
        }
        if (cartGstEl) cartGstEl.textContent = gst;
    } else {
        if (cartGstLineEl) cartGstLineEl.style.display = "none";
    }
    
    if (cartTotalEl) cartTotalEl.textContent = total;

    ["headerCartCount", "floatCartCount"].forEach(id => {
        const el = $(id);
        if (el) { el.textContent = count; el.dataset.count = count; }
    });
    if ($("floatCartTotal")) $("floatCartTotal").textContent = total;
    $("floatCart")?.classList.toggle("is-hidden", count === 0);
    $("headerCartBtn")?.classList.toggle("has-items", count > 0);

    const body = $("cartItems");
    if (!body) return;
    if (!cart.length) {
        body.innerHTML = '<p style="text-align:center;color:var(--muted);padding:40px 0">Your cart is empty</p>';
        syncAddButtons();
        renderAlsoBuy();
        return;
    }
    body.innerHTML = cart.map(item => `
        <div class="cart-line-item">
            <img src="${addCacheBuster(item.image)}" alt="">
            <div class="cart-line-info">
                <h4>${esc(item.name)}</h4>
                <p>₹${item.price * item.qty}</p>
                <div class="cart-qty-row">
                    <button type="button" data-dec="${esc(item.name)}">−</button>
                    <span>${item.qty}</span>
                    <button type="button" data-inc="${esc(item.name)}">+</button>
                    <button type="button" class="cart-remove" data-rem="${esc(item.name)}">Remove</button>
                </div>
            </div>
        </div>
    `).join("");

    body.querySelectorAll("[data-inc]").forEach(b => b.addEventListener("click", () => changeQty(b.dataset.inc, 1)));
    body.querySelectorAll("[data-dec]").forEach(b => b.addEventListener("click", () => changeQty(b.dataset.dec, -1)));
    body.querySelectorAll("[data-rem]").forEach(b => b.addEventListener("click", () => removeFromCart(b.dataset.rem)));
    syncAddButtons();
    renderAlsoBuy();
}

function openCart() {
    updateCartUI();
    $("cartDrawer")?.classList.add("open");
    $("cartOverlay")?.classList.add("open");
    $("cartDrawer")?.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeCart() {
    $("cartDrawer")?.classList.remove("open");
    $("cartOverlay")?.classList.remove("open");
    $("cartDrawer")?.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

/* ===== FOOD MODAL ===== */
function openFoodModal(item) {
    modalItem = item;
    modalQty = cart.find(c => c.name === item.name)?.qty || 1;
    $("modalImg").src = addCacheBuster(item.image);
    $("modalTitle").textContent = item.name;
    $("modalDesc").textContent = item.description;
    if ($("modalIngredients")) $("modalIngredients").textContent = `Ingredients: ${item.ingredients}`;
    $("modalRating").textContent = `⭐ ${item.rating}`;
    $("modalPrep").textContent = `⏱ ${item.prepTime}`;
    $("modalReviews").textContent = `(${item.reviews} reviews)`;
    $("modalVeg").className = "veg-indicator " + (item.isVeg ? "veg" : "nonveg");
    $("modalQty").textContent = modalQty;
    $("modalPrice").textContent = item.price * modalQty;
    $("modalNotes").value = "";
    $("foodModal")?.classList.add("open");
    $("foodModal")?.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeFoodModal() {
    $("foodModal")?.classList.remove("open");
    $("foodModal")?.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    modalItem = null;
}

/* ===== CHECKOUT & ORDER ===== */
function openCheckout() {
    if (!cart.length) { showToast("Cart is empty", true); return; }
    closeCart();

    // Pre-fill table from URL
    const tableNum = getTableNumber();
    if (tableNum && $("checkoutTable")) $("checkoutTable").value = tableNum;

    const sum = $("checkoutSummary");
    if (sum) {
        let sub = 0;
        let itemsHtml = cart.map(i => {
            sub += i.price * i.qty;
            return `<p><span>${i.qty}× ${esc(i.name)}</span><span>₹${i.price * i.qty}</span></p>`;
        }).join("");
        
        let gstHtml = "";
        let total = sub;
        if (CONFIG.gstEnabled) {
            const gst = Math.round(sub * CONFIG.gstRate);
            total = sub + gst;
            const gstPercent = Math.round(CONFIG.gstRate * 100);
            gstHtml = `<p><span>GST (${gstPercent}%)</span><span>₹${gst}</span></p>`;
        }
        
        sum.innerHTML = itemsHtml + gstHtml + `<p style="font-weight:800;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)"><span>Total</span><span>₹${total}</span></p>`;
    }

    $("screenCheckout")?.classList.add("open");
    $("screenCheckout")?.setAttribute("aria-hidden", "false");
}

function closeScreens() {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
    document.querySelectorAll(".full-screen.open").forEach(s => {
        s.classList.remove("open");
        s.setAttribute("aria-hidden", "true");
    });
    document.body.style.overflow = "";
}

/* ===== HELPER: copy message & open WhatsApp group (desktop fallback) ===== */
function _copyAndOpenGroup(msg, groupUrl) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(msg)
            .then(() => showToast("📋 Order copied! Open the WhatsApp group & paste to send."))
            .catch(() => showToast("📲 Opening WhatsApp group — paste your order & send."));
    } else {
        try {
            const ta = document.createElement("textarea");
            ta.value = msg;
            ta.style.cssText = "position:fixed;opacity:0;pointer-events:none;";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            showToast("📋 Order copied! Paste it in the WhatsApp group & send.");
        } catch {
            showToast("📲 Opening WhatsApp group — type your order there.");
        }
    }
    window.open(groupUrl, "_blank");
}

let _isPlacingOrder = false;

async function placeOrder() {
    if (_isPlacingOrder) return;
    _isPlacingOrder = true;

    const placeBtn = $("placeOrderBtn");
    if (placeBtn) {
        placeBtn.disabled = true;
        placeBtn.textContent = "⏳ Sending Order to Kitchen...";
    }

    try {
        if (!cart.length) {
            showToast("⚠️ Your cart is empty", true);
            _isPlacingOrder = false;
            if (placeBtn) {
                placeBtn.disabled = false;
                placeBtn.textContent = "🚀 Confirm & Send Order to Kitchen";
            }
            return;
        }

        const name = ($("checkoutName")?.value || "").trim();
        if (!name) {
            showToast("⚠️ Please enter your Name to place your order", true);
            if ($("checkoutName")) $("checkoutName").focus();
            _isPlacingOrder = false;
            if (placeBtn) {
                placeBtn.disabled = false;
                placeBtn.textContent = "🚀 Confirm & Send Order to Kitchen";
            }
            return;
        }

        const phone = ($("checkoutPhone")?.value || "").trim() || "";
        const notes = ($("checkoutNotes")?.value || "").trim() || "";
        const devId = (typeof window.sbGetDeviceId === 'function') ? window.sbGetDeviceId() : ('dev_' + Date.now());

        // 1. Check if this device session already has an active token
        let assignedTokenNum = null;
        let tokenLabel = "";

        if (typeof window.sbGetActiveDeviceToken === 'function') {
            const activeSession = await window.sbGetActiveDeviceToken(devId);
            if (activeSession && activeSession.tokenNumber) {
                assignedTokenNum = activeSession.tokenNumber;
                tokenLabel = `Token #${assignedTokenNum}`;
            }
        }

        // 2. If no active token exists for this device, allocate next available sequential token number
        if (!assignedTokenNum) {
            if (typeof window.sbGetNextAvailableTokenNumber === 'function') {
                assignedTokenNum = await window.sbGetNextAvailableTokenNumber();
            } else {
                assignedTokenNum = 1;
            }
            tokenLabel = `Token #${assignedTokenNum}`;
        }

        localStorage.setItem('ccd_active_token_number', String(assignedTokenNum));
        localStorage.setItem('ccd_profile_name', name);
        if (phone) localStorage.setItem('ccd_profile_phone', phone);

        let sub = 0;
        const itemsList = cart.map(i => {
            const lineSub = (Number(i.price) || 0) * (Number(i.qty) || 1);
            sub += lineSub;
            return {
                name: i.name,
                original_name: i.original_name || i.name,
                qty: Number(i.qty) || 1,
                price: Number(i.price) || 0,
                notes: i.notes || ""
            };
        });

        let gst = 0;
        if (CONFIG.gstEnabled) {
            gst = Math.round(sub * CONFIG.gstRate);
        }
        const total = sub + gst;

        if (!window.sb && typeof window.sbInit === 'function') {
            window.sbInit();
        }

        if (window.sb && typeof window.sbSaveOrder === 'function') {
            try {
                const ok = await window.sbSaveOrder({
                    tableNumber: tokenLabel,
                    customerName: name,
                    customerPhone: phone || null,
                    items: itemsList,
                    subtotal: sub,
                    gst: gst,
                    total: total,
                    notes: notes || null,
                    device_id: devId
                });
                if (!ok) throw new Error("Database rejected order");
            } catch (e) {
                console.error('[SB] Failed to save order:', e);
                showToast("⚠️ Order Failed: " + (e.message || "Unable to send order to kitchen."), true);
                _isPlacingOrder = false;
                if (placeBtn) {
                    placeBtn.disabled = false;
                    placeBtn.textContent = "🚀 Confirm & Send Order to Kitchen";
                }
                return;
            }
        } else {
            console.error('[SB] Supabase client unavailable');
            showToast("⚠️ Order Failed: Database connection unavailable.", true);
            _isPlacingOrder = false;
            if (placeBtn) {
                placeBtn.disabled = false;
                placeBtn.textContent = "🚀 Confirm & Send Order to Kitchen";
            }
            return;
        }

        // Populate order details on success screen
        if ($("successTableBadge")) $("successTableBadge").textContent = `${tokenLabel} · ${name}`;
        if ($("successOrderItems")) {
            const itemsHtml = itemsList.map(i => `<div>${i.qty}× ${esc(i.name)} — ₹${i.price * i.qty}</div>`).join('');
            $("successOrderItems").innerHTML = itemsHtml + `<div style="font-weight:800; color:var(--text); margin-top:6px; padding-top:6px; border-top:1px dashed var(--border);">Total: ₹${total}</div>`;
        }

        // Update Token Header Badge on Customer Screen
        updateTokenBadgeUI(tokenLabel, name);

        // Clear cart after placing order
        cart = [];
        updateCartUI();

        // Show customer success screen
        closeScreens();
        $("screenSuccess")?.classList.add("open");
        $("screenSuccess")?.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        showToast(`🎉 Order sent to kitchen! (${tokenLabel})`);
        launchConfetti();
        
        // Start listening to real-time status updates for this Token
        startDeviceTokenRealtimeListener(assignedTokenNum, devId);

    } catch (err) {
        console.error("Error placing order:", err);
        showToast("⚠️ An error occurred. Please try again.", true);
    } finally {
        if (placeBtn) {
            placeBtn.disabled = false;
            placeBtn.textContent = "🚀 Confirm & Send Order to Kitchen";
        }
        setTimeout(() => { _isPlacingOrder = false; }, 1500);
    }
}

function updateTokenBadgeUI(tokenLabel, customerName) {
    const badge = $("navTableBadge");
    const label = $("tableLabel");
    if (badge && label) {
        label.textContent = `${tokenLabel}${customerName ? ' (' + customerName + ')' : ''}`;
        badge.classList.remove("is-hidden");
        badge.style.display = "flex";
    }
}

let _tokenRealtimeChannel = null;

function startDeviceTokenRealtimeListener(tokenNum, devId) {
    if (!window.sb) return;

    if (_tokenRealtimeChannel) {
        try { window.sb.removeChannel(_tokenRealtimeChannel); } catch(e) {}
    }

    try {
        _tokenRealtimeChannel = window.sb.channel(`device_token_${tokenNum}_${Date.now()}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
                const newRow = payload.new;
                if (!newRow) return;

                const rowTokenStr = String(newRow.table_number || '');
                const isMatchingToken = rowTokenStr.includes(String(tokenNum)) || newRow.device_id === devId;

                if (isMatchingToken) {
                    if (newRow.status === 'ready' || newRow.status === 'served') {
                        showTokenReadyModal(tokenNum);
                    } else if (newRow.status === 'billed') {
                        showTokenClearedNotice(tokenNum);
                    }
                }
            })
            .subscribe();
    } catch(e) {
        console.warn('[SB] Realtime token listener error:', e);
    }
}

function showTokenReadyModal(tokenNum) {
    let modal = $("tokenReadyModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "tokenReadyModal";
        modal.className = "modal-sheet open";
        modal.innerHTML = `
            <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
            <div class="modal-panel food-modal-panel" style="max-width:380px; text-align:center; padding:28px 20px;">
                <div style="font-size:3.5rem; margin-bottom:10px;">🎉</div>
                <h2 style="font-size:1.4rem; font-weight:900; color:var(--text);" id="tokenReadyModalTitle">Token #${tokenNum} is Ready!</h2>
                <p style="color:var(--muted); font-size:0.9rem; margin:10px 0 20px;">Your order is prepared and ready! Please collect your order from the counter.</p>
                <button type="button" class="btn-primary" onclick="this.closest('.modal-sheet').remove()" style="width:100%;">Okay, Got It!</button>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        if ($("tokenReadyModalTitle")) $("tokenReadyModalTitle").textContent = `Token #${tokenNum} is Ready!`;
        modal.classList.add("open");
    }
    showToast(`🎉 Token #${tokenNum} is Ready!`);
}

function showTokenClearedNotice(tokenNum) {
    localStorage.removeItem('ccd_active_token_number');
    showToast(`✅ Token #${tokenNum} Bill Settled. Thank you!`);
    const badge = $("navTableBadge");
    if (badge) badge.style.display = "none";
}

async function checkDeviceTokenOnLoad() {
    const savedName = localStorage.getItem('ccd_profile_name') || '';
    if (savedName && $("checkoutName")) {
        $("checkoutName").value = savedName;
    }
    const savedPhone = localStorage.getItem('ccd_profile_phone') || '';
    if (savedPhone && $("checkoutPhone")) {
        $("checkoutPhone").value = savedPhone;
    }

    if (typeof window.sbGetActiveDeviceToken === 'function') {
        const active = await window.sbGetActiveDeviceToken();
        if (active && active.tokenNumber) {
            updateTokenBadgeUI(active.tokenLabel, active.customerName);
            startDeviceTokenRealtimeListener(active.tokenNumber, window.sbGetDeviceId());
        }
    }
}

function launchConfetti() {
    const layer = $("confettiLayer");
    if (!layer) return;
    layer.innerHTML = "";
    const colors = ["#d4af37", "#e8c547", "#a67c00", "#22c55e", "#e8d5a3", "#f5f0e6", "#d32f2f"];
    for (let i = 0; i < 48; i++) {
        const p = document.createElement("span");
        p.className = "confetti-piece";
        p.style.left = Math.random() * 100 + "%";
        p.style.background = colors[i % colors.length];
        p.style.animationDelay = Math.random() * 0.4 + "s";
        p.style.animationDuration = 1.8 + Math.random() * 1.2 + "s";
        layer.appendChild(p);
    }
}

function startOrderTracking() {
    const steps = document.querySelectorAll("#trackTimeline li");
    let step = 1;
    const advance = () => {
        if (step >= steps.length) return;
        steps.forEach((li, i) => {
            li.classList.remove("active");
            if (i < step) li.classList.add("done");
            if (i === step) li.classList.add("active");
        });
        step++;
        if (step < steps.length) setTimeout(advance, 4000);
    };
    setTimeout(advance, 2000);
}

/* ===== WAITER FAB & WATER CONFIRMATION ===== */
let waterQty = 1;
const WATER_PRICE = 20;

function updateWaterModalUI() {
    if ($("waterQty")) $("waterQty").textContent = waterQty;
    if ($("waterTotalPrice")) $("waterTotalPrice").textContent = waterQty * WATER_PRICE;
}

function openWaterConfirmationModal() {
    waterQty = 1;
    let modal = $("waterModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.className = "modal-sheet";
        modal.id = "waterModal";
        modal.setAttribute("aria-hidden", "true");
        modal.innerHTML = `
            <div class="modal-backdrop" data-close></div>
            <div class="modal-panel food-modal-panel" style="max-width: 380px; text-align: center; padding: 24px;">
                <button type="button" class="modal-close" data-close aria-label="Close">✕</button>
                <div style="font-size: 3rem; margin-bottom: 8px;">💧</div>
                <h2 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 4px; color: var(--text);">Order Water Bottle</h2>
                <p style="color: var(--muted); font-size: 0.88rem; margin-bottom: 18px;">Chilled & Sealed Mineral Water (1 Liter)</p>
                
                <div class="qty-row" style="justify-content: center; gap: 16px; margin-bottom: 20px;">
                    <span style="font-weight: 700;">Quantity:</span>
                    <div class="qty-ctrl">
                        <button type="button" id="waterQtyMinus">−</button>
                        <span id="waterQty">1</span>
                        <button type="button" id="waterQtyPlus">+</button>
                    </div>
                </div>
                
                <div style="font-size: 1.15rem; font-weight: 800; color: var(--text); margin-bottom: 24px; padding: 10px; background: rgba(212, 175, 55, 0.08); border-radius: 12px; border: 1px dashed var(--border);">
                    Total: ₹<span id="waterTotalPrice">20</span>
                </div>

                <div style="display: flex; gap: 10px;">
                    <button type="button" class="btn-ghost" id="cancelWaterBtn" style="flex: 1;">Cancel</button>
                    <button type="button" class="btn-primary" id="confirmWaterBtn" style="flex: 1;">Confirm Order</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        bindWaterModalEvents();
    }

    updateWaterModalUI();
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeWaterModal() {
    const modal = $("waterModal");
    if (modal) {
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }
}

let _waterEventsBound = false;
function bindWaterModalEvents() {
    if (_waterEventsBound) return;
    _waterEventsBound = true;

    const modal = $("waterModal");
    if (!modal) return;

    modal.querySelectorAll("[data-close], #cancelWaterBtn").forEach(el => {
        el.addEventListener("click", closeWaterModal);
    });

    $("waterQtyMinus")?.addEventListener("click", () => {
        if (waterQty > 1) {
            waterQty--;
            updateWaterModalUI();
        }
    });

    $("waterQtyPlus")?.addEventListener("click", () => {
        waterQty++;
        updateWaterModalUI();
    });

    $("confirmWaterBtn")?.addEventListener("click", confirmAndPlaceWaterOrder);
}

async function confirmAndPlaceWaterOrder() {
    const btn = $("confirmWaterBtn");
    if (btn) {
        btn.disabled = true;
        btn.textContent = "⏳ Ordering...";
    }

    try {
        const tableNum = getTableNumber() || "Takeaway";
        const itemsList = [{
            name: "Water Bottle",
            qty: waterQty,
            price: WATER_PRICE,
            notes: "Water Order"
        }];
        const total = waterQty * WATER_PRICE;

        if (window.sb && typeof window.sbSaveOrder === 'function') {
            const ok = await window.sbSaveOrder({
                tableNumber: tableNum,
                customerName: "Guest",
                customerPhone: null,
                items: itemsList,
                subtotal: total,
                gst: 0,
                total: total,
                notes: "Water Order"
            });
            if (!ok) {
                showToast("⚠️ Order Failed: Unable to send water order to kitchen.", true);
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = "Confirm Order";
                }
                return;
            }
        }

        closeWaterModal();

        if ($("successTableBadge")) $("successTableBadge").textContent = `Table #${tableNum}`;
        if ($("successOrderItems")) {
            const itemsHtml = itemsList.map(i => `<div>${i.qty}× ${esc(i.name)} — ₹${i.price * i.qty}</div>`).join('');
            $("successOrderItems").innerHTML = itemsHtml + `<div style="font-weight:800; color:var(--text); margin-top:6px; padding-top:6px; border-top:1px dashed var(--border);">Total: ₹${total}</div>`;
        }

        closeScreens();
        $("screenSuccess")?.classList.add("open");
        $("screenSuccess")?.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        showToast(`💧 ${waterQty} Water Bottle(s) ordered successfully!`);
        launchConfetti();
        startOrderTracking();
    } catch (err) {
        console.error("Error ordering water:", err);
        showToast("⚠️ Failed to order water.", true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Confirm Order";
        }
    }
}

function initWaiter() {
    if ($("waterModal")) {
        bindWaterModalEvents();
    }
    $("waiterFab")?.addEventListener("click", () => {
        openWaterConfirmationModal();
    });
}

/* ===== MODAL EVENTS ===== */
function initModals() {
    document.querySelectorAll("[data-close]").forEach(el => {
        el.addEventListener("click", () => {
            el.closest(".modal-sheet")?.classList.remove("open");
            el.closest(".modal-sheet")?.setAttribute("aria-hidden", "true");
            document.body.style.overflow = "";
        });
    });

    $("closeCart")?.addEventListener("click", closeCart);
    $("cartOverlay")?.addEventListener("click", closeCart);
    $("continueOrder")?.addEventListener("click", closeCart);
    $("proceedCheckout")?.addEventListener("click", openCheckout);
    $("placeOrderBtn")?.addEventListener("click", placeOrder);

    // Variant picker close
    $("variantModalClose")?.addEventListener("click", closeVariantPicker);
    $("variantModalBackdrop")?.addEventListener("click", closeVariantPicker);

    $("successContinue")?.addEventListener("click", () => {
        closeScreens();
        renderMenu();
    });

    document.querySelectorAll("[data-screen-close]").forEach(b => b.addEventListener("click", closeScreens));

    $("modalQtyMinus")?.addEventListener("click", () => {
        if (modalQty > 1) {
            modalQty--;
            $("modalQty").textContent = modalQty;
            $("modalPrice").textContent = modalItem.price * modalQty;
        }
    });
    $("modalQtyPlus")?.addEventListener("click", () => {
        modalQty++;
        $("modalQty").textContent = modalQty;
        $("modalPrice").textContent = modalItem.price * modalQty;
    });
    $("modalAddBtn")?.addEventListener("click", () => {
        if (!modalItem) return;
        const itemToSave = modalItem;
        const qtyToSave = modalQty;
        const notesToSave = $("modalNotes")?.value || "";
        const variants = parseVariants(itemToSave.name);
        if (variants) {
            closeFoodModal();
            openVariantPicker(itemToSave, $("modalAddBtn"));
            return;
        }
        const ex = cart.find(c => c.name === itemToSave.name);
        if (ex) {
            ex.qty = qtyToSave;
            if (notesToSave) ex.notes = notesToSave;
        } else {
            cart.push({ ...itemToSave, qty: qtyToSave, notes: notesToSave });
        }
        updateCartUI();
        flyToCart(itemToSave.image, $("modalAddBtn"));
        closeFoodModal();
        showToast("✅ Added to cart");
    });

    document.addEventListener("keydown", e => {
        if (e.key === "Escape") {
            closeCart();
            closeFoodModal();
            closeWaterModal();
            closeScreens();
            document.querySelectorAll(".modal-sheet.open").forEach(m => {
                m.classList.remove("open");
                m.setAttribute("aria-hidden", "true");
            });
        }
    });
}

/* ===== INIT ===== */
function init() {
    // Skip init on admin pages (check for admin-only elements)
    if (document.getElementById('adminToolbar') || document.getElementById('adminLoginOverlay')) {
        return;
    }

    initWelcome();
    initHeader();
    renderMainCategories();
    renderSubCategories();
    renderMenu();
    initModals();
    initWaiter();
    updateCartUI();
    checkDeviceTokenOnLoad();

    // Load live menu items and config from Supabase
    loadDataFromSupabase().then(async () => {
      if (window.sb && menuItemsCache.length === 0) {
        await sbSeedMenuIfEmpty(menuData.restaurant);
        await loadDataFromSupabase();
      }
    });
    if (window.sb) {
      const refreshAll = () => loadDataFromSupabase();
      sbSubscribeMenuChanges(refreshAll);
      sbSubscribeConfigChanges(refreshAll);
      sbSubscribeCategoryOverridesChanges(refreshAll);
    }

    // Apply tagline
    if ($("welcomeTagline")) $("welcomeTagline").textContent = CONFIG.tagline;
    if ($("heroTagline")) $("heroTagline").textContent = CONFIG.tagline;
  }

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
