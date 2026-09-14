/**
 * Cafe Coffee Delite — Admin Panel Visual Editor Script
 */

/* ===== HELPER: Format WhatsApp Number ===== */
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

/* ===== GLOBAL STATE ===== */
let hasAttemptedSupabaseLoad = false;

/* ===== AUTHENTICATION (Supabase) ===== */
const loginOverlay = document.getElementById("adminLoginOverlay");
const loginForm = document.getElementById("adminLoginForm");
const loginError = document.getElementById("loginError");

if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const inputEmail = document.getElementById("adminIdInput").value.trim();
        const inputPass = document.getElementById("adminPassInput").value.trim();
        
        try {
            const { error } = await sb.auth.signInWithPassword({
                email: inputEmail,
                password: inputPass
            });

            if (error) {
                loginError.classList.remove("is-hidden");
                loginError.textContent = error.message;
                return;
            }

            loginOverlay.classList.add("is-hidden");
            loginError.classList.add("is-hidden");
            initVisualEditor();
            showToast("Logged in as Admin");
        } catch (err) {
            loginError.classList.remove("is-hidden");
            loginError.textContent = "Failed to login. Please try again.";
        }
    });
}

async function checkLogin() {
    if (!sb) {
        // No Supabase configured yet, just show the editor with local data
        if (loginOverlay) loginOverlay.classList.add("is-hidden");
        initVisualEditor();
        return;
    }
    const { data: { session } } = await sb.auth.getSession();

    if (session) {
        if (loginOverlay) loginOverlay.classList.add("is-hidden");
        initVisualEditor();
    } else {
        if (loginOverlay) loginOverlay.classList.remove("is-hidden");
    }
}

async function logoutAdmin() {
    if (sb) {
        await sb.auth.signOut();
    }
    window.location.reload();
}

/* ===== VISUAL EDITOR INITS ===== */
function initVisualEditor() {
    // 1. Override Card Building to Add Admin Editing Controls
    // Global admin action helpers
    window.adminMoveItem = (name, dir) => shiftItemOrder(name, dir);
    window.adminEditItem = (name) => {
        const item = getItems().find(i => i.name === name);
        if (item) openItemEditForm(item);
    };

    // Hide Add-to-cart button in admin mode
    const adminStyle = document.createElement('style');
    adminStyle.textContent = '.admin-page-body .add-btn { display: none !important; }';
    document.head.appendChild(adminStyle);

    // Expose enable/disable helpers for admin inline onclick
    window.adminEnableItem = (name) => {
        enabledComingSoonItems.add(name);
        saveEnabledComingSoon();
        renderMenu();
        showToast(`✅ "${name}" enabled for ordering`);
    };
    window.adminDisableItem = (name) => {
        enabledComingSoonItems.delete(name);
        saveEnabledComingSoon();
        renderMenu();
        showToast(`🔒 "${name}" set back to Coming Soon`);
    };
    window.adminEnableAllInCategory = (category) => {
        enableAllComingSoonInCategory(category);
    };

    const originalBuildCard = window.buildCard;
    // Override buildCard to add admin controls (and use addCacheBuster if needed, but originalBuildCard should now handle it)
  window.buildCard = function(item, i) {
    // Ensure item.image uses cache buster if needed (though originalBuildCard now does this)
    const defaultHtml = originalBuildCard(item, i);
        const n = esc(item.name);
        const isComingSoon = isCategoryComingSoon(item.category);
        const isEnabled = enabledComingSoonItems.has(item.name);
        const isHardcoded = item.name === "Chicken Fry Piece Biryani" || item.name === "Chicken Dum Biryani" ||
                            item.name === "Banana Leaf Biryani" ||
                            item.name === "Pepper Chicken" || item.name === "8 to 8 Chicken" ||
                            item.name === "Chilli Chicken" || item.name === "Schezwan Chicken";

        // Enable/Disable toggle only for coming-soon category items (not hardcoded ones)
        const toggleBtn = isComingSoon && !isHardcoded
            ? isEnabled
                ? `<button type="button" class="admin-enable-toggle admin-enable-toggle--on" onclick="event.stopPropagation();adminDisableItem('${n}')" title="Disable ordering">\ud83d\udd12 Enabled \u2014 tap to disable</button>`
                : `<button type="button" class="admin-enable-toggle admin-enable-toggle--off" onclick="event.stopPropagation();adminEnableItem('${n}')" title="Enable ordering">\ud83d\udd13 Enable Order</button>`
            : '';

        const adminControls = `
            <div class="admin-card-controls">
                <button type="button" class="admin-reorder-btn" onclick="event.stopPropagation();adminMoveItem('${n}',-1)" title="Move Left/Up">\u25c4</button>
                <button type="button" class="admin-reorder-btn" onclick="event.stopPropagation();adminMoveItem('${n}',1)" title="Move Right/Down">\u25ba</button>
                <span class="admin-edit-badge" onclick="event.stopPropagation();adminEditItem('${n}')">\u270f\ufe0f Edit</span>
                ${toggleBtn}
            </div>
        `;
        return defaultHtml.replace("</article>", adminControls + "</article>");
    };

    // 2. Override Card Click Events to Open Edit Form
    window.openFoodModal = function(item) {
        openItemEditForm(item);
    };

    // Load data from Supabase first
    loadDataFromSupabaseAdmin();

    // Subscribe to real-time changes in admin too
    if (window.sb) {
      const refreshAllAdmin = () => {
        // Don't refresh if we're editing an item (modal is open)
        const itemModal = document.getElementById('adminItemModal');
        const settingsModal = document.getElementById('adminSettingsModal');
        const heroEditorDock = document.getElementById('heroEditorDock');
        if ((itemModal && itemModal.classList.contains('open')) || 
            (settingsModal && settingsModal.classList.contains('open')) ||
            (heroEditorDock && heroEditorDock.classList.contains('open'))) {
          return;
        }
        loadDataFromSupabaseAdmin();
      };
      sbSubscribeMenuChanges(refreshAllAdmin);
      sbSubscribeConfigChanges(refreshAllAdmin);
      sbSubscribeCategoryOverridesChanges(refreshAllAdmin);
    }

    // 3. Re-render Categories and Menu with new Admin cards
    renderCategories();
    renderMenu();

    // 4. Bind Editable Category renaming (double click)
    hookCategoryRenaming();

    // 5. Bind Editable Hero Background clicks
    const heroBgEl = document.querySelector(".hero-clean-bg");
    if (heroBgEl) {
        heroBgEl.addEventListener("click", async () => {
            const currentBg = CONFIG.heroBg || "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1200";
            const newBg = prompt("Enter new background image URL (Unsplash or direct link):", currentBg);
            if (newBg !== null) {
                CONFIG.heroBg = newBg.trim() || currentBg;
                await saveConfig();
                applyBrand();
                showToast("Hero background image updated!");
            }
        });
    }

    // Bind Hero Editor Dock Toggle
    document.getElementById("heroEditorDockToggle")?.addEventListener("click", toggleHeroEditor);
    document.getElementById("heroEditorDockCloseBtn")?.addEventListener("click", toggleHeroEditor);

    // Bind Hero Editor Actions
    document.getElementById("heroAddTextBtn")?.addEventListener("click", () => addHeroBlock("text"));
    document.getElementById("heroAddImageBtn")?.addEventListener("click", () => addHeroBlock("image"));
    document.getElementById("heroDuplicateBlockBtn")?.addEventListener("click", duplicateSelectedHeroBlock);
    document.getElementById("heroDeleteBlockBtn")?.addEventListener("click", deleteSelectedHeroBlock);
    document.getElementById("heroSaveLayoutBtn")?.addEventListener("click", saveHeroEditorLayout);

    // Bind Hero Editor Controls
    bindHeroControl(document.getElementById("heroBlockText"), () => updateSelectedHeroBlock({ text: document.getElementById("heroBlockText").value }));
    bindHeroControl(document.getElementById("heroBlockImage"), () => updateSelectedHeroBlock({ image: document.getElementById("heroBlockImage").value.trim() }));
    bindHeroControl(document.getElementById("heroFontFamily"), () => updateSelectedHeroBlock({ fontFamily: document.getElementById("heroFontFamily").value.trim() || "Outfit, sans-serif" }));
    bindHeroControl(document.getElementById("heroFontUrl"), () => updateSelectedHeroBlock({ fontUrl: document.getElementById("heroFontUrl").value.trim() }));
    bindHeroControl(document.getElementById("heroFontSize"), () => updateSelectedHeroBlock({ fontSize: document.getElementById("heroFontSize").value }), ["input", "change"]);
    bindHeroControl(document.getElementById("heroFontWeight"), () => updateSelectedHeroBlock({ fontWeight: document.getElementById("heroFontWeight").value }), ["change"]);
    bindHeroControl(document.getElementById("heroTextColor"), () => updateSelectedHeroBlock({ color: document.getElementById("heroTextColor").value }));
    bindHeroControl(document.getElementById("heroTextAlign"), () => updateSelectedHeroBlock({ textAlign: document.getElementById("heroTextAlign").value }), ["change"]);
    bindHeroControl(document.getElementById("heroBlockX"), () => updateSelectedHeroBlock({ x: document.getElementById("heroBlockX").value }), ["input", "change"]);
    bindHeroControl(document.getElementById("heroBlockY"), () => updateSelectedHeroBlock({ y: document.getElementById("heroBlockY").value }), ["input", "change"]);
    bindHeroControl(document.getElementById("heroBlockWidth"), () => updateSelectedHeroBlock({ width: document.getElementById("heroBlockWidth").value }), ["input", "change"]);
    bindHeroControl(document.getElementById("heroBlockHeight"), () => updateSelectedHeroBlock({ height: document.getElementById("heroBlockHeight").value }), ["input", "change"]);
    bindHeroControl(document.getElementById("heroBlockBg"), () => updateSelectedHeroBlock({ backgroundColor: document.getElementById("heroBlockBg").value }));
    bindHeroControl(document.getElementById("heroBorderColor"), () => updateSelectedHeroBlock({ borderColor: document.getElementById("heroBorderColor").value }));
    bindHeroControl(document.getElementById("heroBorderWidth"), () => updateSelectedHeroBlock({ borderWidth: document.getElementById("heroBorderWidth").value }), ["input", "change"]);
    bindHeroControl(document.getElementById("heroBorderRadius"), () => updateSelectedHeroBlock({ borderRadius: document.getElementById("heroBorderRadius").value }), ["input", "change"]);
    bindHeroControl(document.getElementById("heroPadding"), () => updateSelectedHeroBlock({ padding: document.getElementById("heroPadding").value }), ["input", "change"]);
    bindHeroControl(document.getElementById("heroOpacity"), () => updateSelectedHeroBlock({ opacity: document.getElementById("heroOpacity").value }), ["input", "change"]);
    bindHeroControl(document.getElementById("heroImageFit"), () => updateSelectedHeroBlock({ imageFit: document.getElementById("heroImageFit").value }), ["change"]);
    bindHeroControl(document.getElementById("heroShadow"), () => updateSelectedHeroBlock({ shadow: document.getElementById("heroShadow").value }), ["change"]);

    // Bind Image File Input
    document.getElementById("heroBlockImageFile")?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            e.target.value = "";
            showToast("Please choose an image file", true);
            return;
        }
        try {
            const dataUrl = await readFileAsDataUrl(file);
            updateSelectedHeroBlock({ image: dataUrl });
            syncHeroEditorControls();
        } catch (error) {
            showToast("Could not read the selected hero image", true);
        }
    });

    // Bind Clear Image Button
    document.getElementById("heroClearImageUploadBtn")?.addEventListener("click", () => {
        const block = getSelectedHeroBlock();
        if (!block) return;
        const fileInput = document.getElementById("heroBlockImageFile");
        if (fileInput) fileInput.value = "";
        block.image = "";
        renderHeroEditorBlocks();
        syncHeroEditorControls();
    });

    // Click hero background to deselect
    heroSection?.addEventListener("click", (e) => {
        if (e.target === heroSection || e.target.closest(".hero-clean-bg")) {
            heroEditorState.selectedId = null;
            syncHeroEditorControls();
            renderHeroEditorBlocks();
        }
    });

    // 6. Bind Editable Hero Offers clicks
    document.querySelectorAll(".hero-offers .hero-offer").forEach((offerEl, idx) => {
        offerEl.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!Array.isArray(CONFIG.offers)) CONFIG.offers = [];
            const currentOffer = CONFIG.offers[idx] || { icon: "🎉", title: "", desc: "" };
            
            const icon = prompt("Enter offer emoji or icon (e.g. 🍕, ☕):", currentOffer.icon);
            if (icon === null) return;
            const title = prompt("Enter offer headline:", currentOffer.title);
            if (title === null) return;
            const desc = prompt("Enter offer description:", currentOffer.desc);
            if (desc === null) return;

            CONFIG.offers[idx] = { icon: icon.trim(), title: title.trim(), desc: desc.trim() };
            await saveConfig();
            applyBrand();
            showToast("Offer details updated!");
        });
    });

    document.querySelectorAll("[data-offer-delete]").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const idx = Number(btn.dataset.offerDelete);
            if (!Array.isArray(CONFIG.offers) || !CONFIG.offers[idx]) {
                showToast("No offer to delete", true);
                return;
            }
            if (!confirm("Delete this hero offer?")) return;
            CONFIG.offers.splice(idx, 1);
            await saveConfig();
            applyBrand();
            showToast("Hero offer deleted");
        });
    });

    // 7. Bind Theme Hex Color customizer in navbar
    const themeBtn = document.getElementById("editThemeBtn");
    if (themeBtn) {
        themeBtn.addEventListener("click", () => {
            const savedColor = localStorage.getItem("cafeCustomThemeColor") || "#d32f2f";
            const hex = prompt("Enter custom theme color hex code (e.g. #d32f2f, #3f51b5, #008080):", savedColor);
            if (hex && /^#[0-9A-F]{6}$/i.test(hex)) {
                localStorage.setItem("cafeCustomThemeColor", hex);
                applyCustomThemeColor(hex);
                showToast("Theme color customizer applied!");
            } else if (hex !== null) {
                alert("Invalid color format. Please enter a valid Hex Code (e.g., #d32f2f)");
            }
        });
    }

    // 8. Card body click → open edit form (reorder/edit badge use inline handlers above)

    // 9. Bind Add/Settings/Reset Toolbar buttons
    document.getElementById("adminAddItemBtn")?.addEventListener("click", openItemAddForm);
    document.getElementById("adminSettingsBtn")?.addEventListener("click", openSettingsForm);
    document.getElementById("adminOrdersBtn")?.addEventListener("click", () => window.open("admin-orders.html", "_blank"));
    document.getElementById("adminResetMenuBtn")?.addEventListener("click", resetMenuData);
    document.getElementById("adminLogoutBtn")?.addEventListener("click", logoutAdmin);
}

/* ===== HERO LAYOUT EDITOR ===== */

const heroEditorDock = document.getElementById("heroEditorDock");
const heroEditorDockToggle = document.getElementById("heroEditorDockToggle");
const heroSection = document.getElementById("heroSection");
const heroAddTextBtn = document.getElementById("heroAddTextBtn");
const heroAddImageBtn = document.getElementById("heroAddImageBtn");
const heroDuplicateBlockBtn = document.getElementById("heroDuplicateBlockBtn");
const heroDeleteBlockBtn = document.getElementById("heroDeleteBlockBtn");
const heroSaveLayoutBtn = document.getElementById("heroSaveLayoutBtn");
const heroBlockTypeInput = document.getElementById("heroBlockType");
const heroBlockTextInput = document.getElementById("heroBlockText");
const heroBlockImageInput = document.getElementById("heroBlockImage");
const heroBlockImageFileInput = document.getElementById("heroBlockImageFile");
const heroClearImageUploadBtn = document.getElementById("heroClearImageUploadBtn");
const heroFontFamilyInput = document.getElementById("heroFontFamily");
const heroFontUrlInput = document.getElementById("heroFontUrl");
const heroFontSizeInput = document.getElementById("heroFontSize");
const heroFontWeightInput = document.getElementById("heroFontWeight");
const heroTextColorInput = document.getElementById("heroTextColor");
const heroTextAlignInput = document.getElementById("heroTextAlign");
const heroBlockXInput = document.getElementById("heroBlockX");
const heroBlockYInput = document.getElementById("heroBlockY");
const heroBlockWidthInput = document.getElementById("heroBlockWidth");
const heroBlockHeightInput = document.getElementById("heroBlockHeight");
const heroBlockBgInput = document.getElementById("heroBlockBg");
const heroBorderColorInput = document.getElementById("heroBorderColor");
const heroBorderWidthInput = document.getElementById("heroBorderWidth");
const heroBorderRadiusInput = document.getElementById("heroBorderRadius");
const heroPaddingInput = document.getElementById("heroPadding");
const heroOpacityInput = document.getElementById("heroOpacity");
const heroImageFitInput = document.getElementById("heroImageFit");
const heroShadowInput = document.getElementById("heroShadow");

const heroEditorState = {
    blocks: [],
    selectedId: null,
    dragging: null,
    resizing: null,
    isOpen: false
};

let syncingHeroControls = false;

function ensureHeroLayoutConfig() {
    if (!CONFIG.heroLayout || !Array.isArray(CONFIG.heroLayout.blocks)) {
        CONFIG.heroLayout = { blocks: [] };
    }
}

function generateHeroBlockId() {
    return `hero-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function createDefaultHeroBlock(type) {
    const isImage = type === "image";
    return {
        id: generateHeroBlockId(),
        type: isImage ? "image" : "text",
        text: isImage ? "" : "New Hero Text",
        image: "",
        x: isImage ? 58 : 8,
        y: isImage ? 12 : 12,
        width: isImage ? 24 : 34,
        height: isImage ? 34 : 18,
        padding: 12,
        opacity: 1,
        backgroundColor: isImage ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.28)",
        borderColor: "rgba(255,255,255,0.22)",
        borderWidth: 1,
        borderRadius: 16,
        color: "#ffffff",
        fontSize: 20,
        fontWeight: "700",
        textAlign: "left",
        fontFamily: "Outfit, sans-serif",
        fontUrl: "",
        imageFit: "cover",
        shadow: "soft"
    };
}

function getSelectedHeroBlock() {
    return heroEditorState.blocks.find(block => block.id === heroEditorState.selectedId) || null;
}

function clampHeroBlock(block) {
    block.width = Math.max(5, Math.min(100, Number(block.width) || 5));
    block.height = Math.max(5, Math.min(100, Number(block.height) || 5));
    block.x = Math.max(0, Math.min(100 - block.width, Number(block.x) || 0));
    block.y = Math.max(0, Math.min(100 - block.height, Number(block.y) || 0));
    block.padding = Math.max(0, Math.min(40, Number(block.padding) || 0));
    block.opacity = Math.max(0.1, Math.min(1, Number(block.opacity) || 1));
    block.borderWidth = Math.max(0, Math.min(20, Number(block.borderWidth) || 0));
    block.borderRadius = Math.max(0, Math.min(80, Number(block.borderRadius) || 0));
    block.fontSize = Math.max(10, Math.min(120, Number(block.fontSize) || 10));
}

function setHeroControlsDisabled(disabled) {
    [
        heroBlockTextInput, heroBlockImageInput, heroBlockImageFileInput, heroClearImageUploadBtn,
        heroFontFamilyInput, heroFontUrlInput, heroFontSizeInput, heroFontWeightInput,
        heroTextColorInput, heroTextAlignInput, heroBlockXInput, heroBlockYInput,
        heroBlockWidthInput, heroBlockHeightInput, heroBlockBgInput, heroBorderColorInput,
        heroBorderWidthInput, heroBorderRadiusInput, heroPaddingInput, heroOpacityInput,
        heroImageFitInput, heroShadowInput, heroDuplicateBlockBtn, heroDeleteBlockBtn
    ].forEach(control => {
        if (control) control.disabled = disabled;
    });
}

function addResizeHandles(node) {
    ["nw", "ne", "sw", "se"].forEach(corner => {
        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = `hero-block-resize-handle hero-block-resize-handle--${corner}`;
        handle.dataset.resizeCorner = corner;
        handle.setAttribute("aria-label", `Resize block from ${corner.toUpperCase()} corner`);
        handle.addEventListener("mousedown", startHeroBlockResize);
        handle.addEventListener("touchstart", startHeroBlockResize, { passive: false });
        handle.addEventListener("click", e => e.stopPropagation());
        node.appendChild(handle);
    });
}

function syncHeroEditorControls() {
    const block = getSelectedHeroBlock();
    syncingHeroControls = true;

    if (!block) {
        if (heroBlockTypeInput) heroBlockTypeInput.value = "";
        if (heroBlockTextInput) heroBlockTextInput.value = "";
        if (heroBlockImageInput) heroBlockImageInput.value = "";
        if (heroBlockImageFileInput) heroBlockImageFileInput.value = "";
        if (heroFontFamilyInput) heroFontFamilyInput.value = "";
        if (heroFontUrlInput) heroFontUrlInput.value = "";
        if (heroFontSizeInput) heroFontSizeInput.value = "";
        if (heroFontWeightInput) heroFontWeightInput.value = "700";
        if (heroTextColorInput) heroTextColorInput.value = "#ffffff";
        if (heroTextAlignInput) heroTextAlignInput.value = "left";
        if (heroBlockXInput) heroBlockXInput.value = "";
        if (heroBlockYInput) heroBlockYInput.value = "";
        if (heroBlockWidthInput) heroBlockWidthInput.value = "";
        if (heroBlockHeightInput) heroBlockHeightInput.value = "";
        if (heroBlockBgInput) heroBlockBgInput.value = "#000000";
        if (heroBorderColorInput) heroBorderColorInput.value = "#ffffff";
        if (heroBorderWidthInput) heroBorderWidthInput.value = "";
        if (heroBorderRadiusInput) heroBorderRadiusInput.value = "";
        if (heroPaddingInput) heroPaddingInput.value = "";
        if (heroOpacityInput) heroOpacityInput.value = "";
        if (heroImageFitInput) heroImageFitInput.value = "cover";
        if (heroShadowInput) heroShadowInput.value = "soft";
        setHeroControlsDisabled(true);
        syncingHeroControls = false;
        return;
    }

    setHeroControlsDisabled(false);
    if (heroBlockTypeInput) heroBlockTypeInput.value = block.type;
    if (heroBlockTextInput) heroBlockTextInput.value = block.text || "";
    if (heroBlockImageInput) heroBlockImageInput.value = block.image || "";
    if (heroBlockImageFileInput) heroBlockImageFileInput.value = "";
    if (heroFontFamilyInput) heroFontFamilyInput.value = block.fontFamily || "";
    if (heroFontUrlInput) heroFontUrlInput.value = block.fontUrl || "";
    if (heroFontSizeInput) heroFontSizeInput.value = block.fontSize ?? 20;
    if (heroFontWeightInput) heroFontWeightInput.value = String(block.fontWeight || "700");
    if (heroTextColorInput) heroTextColorInput.value = toHexColor(block.color, "#ffffff");
    if (heroTextAlignInput) heroTextAlignInput.value = block.textAlign || "left";
    if (heroBlockXInput) heroBlockXInput.value = Number(block.x).toFixed(1);
    if (heroBlockYInput) heroBlockYInput.value = Number(block.y).toFixed(1);
    if (heroBlockWidthInput) heroBlockWidthInput.value = Number(block.width).toFixed(1);
    if (heroBlockHeightInput) heroBlockHeightInput.value = Number(block.height).toFixed(1);
    if (heroBlockBgInput) heroBlockBgInput.value = toHexColor(block.backgroundColor, "#000000");
    if (heroBorderColorInput) heroBorderColorInput.value = toHexColor(block.borderColor, "#ffffff");
    if (heroBorderWidthInput) heroBorderWidthInput.value = block.borderWidth ?? 1;
    if (heroBorderRadiusInput) heroBorderRadiusInput.value = block.borderRadius ?? 16;
    if (heroPaddingInput) heroPaddingInput.value = block.padding ?? 12;
    if (heroOpacityInput) heroOpacityInput.value = block.opacity ?? 1;
    if (heroImageFitInput) heroImageFitInput.value = block.imageFit || "cover";
    if (heroShadowInput) heroShadowInput.value = block.shadow || "soft";

    const isText = block.type === "text";
    if (heroBlockTextInput) heroBlockTextInput.disabled = !isText;
    if (heroFontFamilyInput) heroFontFamilyInput.disabled = !isText;
    if (heroFontUrlInput) heroFontUrlInput.disabled = !isText;
    if (heroFontSizeInput) heroFontSizeInput.disabled = !isText;
    if (heroFontWeightInput) heroFontWeightInput.disabled = !isText;
    if (heroTextColorInput) heroTextColorInput.disabled = !isText;
    if (heroTextAlignInput) heroTextAlignInput.disabled = !isText;
    if (heroBlockImageInput) heroBlockImageInput.disabled = isText;
    if (heroBlockImageFileInput) heroBlockImageFileInput.disabled = isText;
    if (heroClearImageUploadBtn) heroClearImageUploadBtn.disabled = isText;
    if (heroImageFitInput) heroImageFitInput.disabled = isText;

    syncingHeroControls = false;
}

function renderHeroEditorBlocks() {
    if (!heroSection) return;
    window.renderHeroBlocksInto(heroSection, heroEditorState.blocks);

    const customLayer = heroSection.querySelector(".hero-custom-layer");
    if (!customLayer) return;

    customLayer.querySelectorAll(".hero-custom-block").forEach(node => {
        const isSelected = node.dataset.blockId === heroEditorState.selectedId;
        node.classList.toggle("is-selected", isSelected);
        if (isSelected) addResizeHandles(node);
        
        // Mouse events
        node.addEventListener("click", (e) => {
            e.stopPropagation();
            heroEditorState.selectedId = node.dataset.blockId;
            syncHeroEditorControls();
            renderHeroEditorBlocks();
        });
        node.addEventListener("mousedown", startHeroBlockDrag);
        
        // Touch events
        node.addEventListener("touchstart", startHeroBlockDrag, { passive: false });
    });
}

function toggleHeroEditor() {
    heroEditorState.isOpen = !heroEditorState.isOpen;
    
    if (heroEditorState.isOpen) {
        ensureHeroLayoutConfig();
        heroEditorState.blocks = deepClone(CONFIG.heroLayout.blocks || []);
        heroEditorState.selectedId = heroEditorState.blocks[0]?.id || null;
        heroSection.classList.add("admin-editing-hero");
        heroEditorDock?.classList.add("open");
        heroEditorDock?.setAttribute("aria-hidden", "false");
        heroEditorDockToggle?.classList.add("open");
        heroEditorDockToggle?.setAttribute("aria-expanded", "true");
        syncHeroEditorControls();
        renderHeroEditorBlocks();
    } else {
        heroSection.classList.remove("admin-editing-hero");
        heroEditorDock?.classList.remove("open");
        heroEditorDock?.setAttribute("aria-hidden", "true");
        heroEditorDockToggle?.classList.remove("open");
        heroEditorDockToggle?.setAttribute("aria-expanded", "false");
        heroEditorState.dragging = null;
        heroEditorState.resizing = null;
        // Restore original hero
        applyBrand();
    }
}

function addHeroBlock(type) {
    const block = createDefaultHeroBlock(type);
    heroEditorState.blocks.push(block);
    heroEditorState.selectedId = block.id;
    syncHeroEditorControls();
    renderHeroEditorBlocks();
}

function duplicateSelectedHeroBlock() {
    const block = getSelectedHeroBlock();
    if (!block) {
        showToast("Select a block to duplicate", true);
        return;
    }
    const duplicate = deepClone(block);
    duplicate.id = generateHeroBlockId();
    duplicate.x = Math.min(100 - duplicate.width, duplicate.x + 4);
    duplicate.y = Math.min(100 - duplicate.height, duplicate.y + 4);
    heroEditorState.blocks.push(duplicate);
    heroEditorState.selectedId = duplicate.id;
    syncHeroEditorControls();
    renderHeroEditorBlocks();
}

function deleteSelectedHeroBlock() {
    if (!heroEditorState.selectedId) {
        showToast("Select a block to delete", true);
        return;
    }
    heroEditorState.blocks = heroEditorState.blocks.filter(block => block.id !== heroEditorState.selectedId);
    heroEditorState.selectedId = heroEditorState.blocks[0]?.id || null;
    syncHeroEditorControls();
    renderHeroEditorBlocks();
}

function updateSelectedHeroBlock(patch) {
    const block = getSelectedHeroBlock();
    if (!block) return;
    Object.assign(block, patch);
    clampHeroBlock(block);
    renderHeroEditorBlocks();
    syncHeroEditorControls();
}

function getEventPosition(event) {
    if (event.touches && event.touches.length > 0) {
        return { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY };
    }
    return { clientX: event.clientX, clientY: event.clientY };
}

function startHeroBlockDrag(event) {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target.closest(".hero-block-resize-handle")) {
        startHeroBlockResize(event);
        return;
    }
    const blockId = event.currentTarget.dataset.blockId;
    const block = heroEditorState.blocks.find(entry => entry.id === blockId);
    if (!block || !heroSection) return;
    heroEditorState.selectedId = blockId;
    const rect = heroSection.getBoundingClientRect();
    const pos = getEventPosition(event);
    heroEditorState.dragging = {
        blockId,
        startX: pos.clientX,
        startY: pos.clientY,
        originX: block.x,
        originY: block.y,
        rect
    };
    heroEditorState.resizing = null;
    syncHeroEditorControls();
    renderHeroEditorBlocks();
    event.preventDefault();
}

function startHeroBlockResize(event) {
    if (event.button !== undefined && event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    const corner = event.currentTarget.dataset.resizeCorner;
    const node = event.currentTarget.closest(".hero-custom-block");
    const blockId = node?.dataset.blockId;
    const block = heroEditorState.blocks.find(entry => entry.id === blockId);
    if (!block || !heroSection || !corner) return;
    const rect = heroSection.getBoundingClientRect();
    const pos = getEventPosition(event);
    heroEditorState.selectedId = blockId;
    heroEditorState.resizing = {
        blockId,
        corner,
        startX: pos.clientX,
        startY: pos.clientY,
        originX: block.x,
        originY: block.y,
        originWidth: block.width,
        originHeight: block.height,
        rect
    };
    heroEditorState.dragging = null;
    syncHeroEditorControls();
    renderHeroEditorBlocks();
}

function onHeroDragMove(event) {
    if (heroEditorState.resizing) return;
    const drag = heroEditorState.dragging;
    if (!drag) return;
    const block = heroEditorState.blocks.find(entry => entry.id === drag.blockId);
    if (!block) return;
    const pos = getEventPosition(event);
    const dx = ((pos.clientX - drag.startX) / drag.rect.width) * 100;
    const dy = ((pos.clientY - drag.startY) / drag.rect.height) * 100;
    block.x = drag.originX + dx;
    block.y = drag.originY + dy;
    clampHeroBlock(block);
    renderHeroEditorBlocks();
    syncHeroEditorControls();
}

function onHeroResizeMove(event) {
    const resize = heroEditorState.resizing;
    if (!resize) return;
    const block = heroEditorState.blocks.find(entry => entry.id === resize.blockId);
    if (!block) return;

    const pos = getEventPosition(event);
    const dx = ((pos.clientX - resize.startX) / resize.rect.width) * 100;
    const dy = ((pos.clientY - resize.startY) / resize.rect.height) * 100;
    const minSize = 5;

    if (resize.corner.includes("e")) {
        block.width = resize.originWidth + dx;
    }
    if (resize.corner.includes("s")) {
        block.height = resize.originHeight + dy;
    }
    if (resize.corner.includes("w")) {
        block.x = resize.originX + dx;
        block.width = resize.originWidth - dx;
    }
    if (resize.corner.includes("n")) {
        block.y = resize.originY + dy;
        block.height = resize.originHeight - dy;
    }

    if (block.width < minSize) {
        if (resize.corner.includes("w")) block.x -= (minSize - block.width);
        block.width = minSize;
    }
    if (block.height < minSize) {
        if (resize.corner.includes("n")) block.y -= (minSize - block.height);
        block.height = minSize;
    }

    clampHeroBlock(block);
    renderHeroEditorBlocks();
    syncHeroEditorControls();
}

function stopHeroInteraction() {
    heroEditorState.dragging = null;
    heroEditorState.resizing = null;
}

async function saveHeroEditorLayout() {
    ensureHeroLayoutConfig();
    CONFIG.heroLayout = { blocks: deepClone(heroEditorState.blocks) };
    await saveConfig();
    applyBrand();
    showToast("Hero layout saved");
}

function toHexColor(color, fallback) {
    if (!color) return fallback;
    if (color.startsWith("#")) return color;
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return fallback;
    const [, r, g, b] = match;
    return `#${[r, g, b].map(value => Number(value).toString(16).padStart(2, "0")).join("")}`;
}

function bindHeroControl(control, handler, eventNames = ["input"]) {
    eventNames.forEach(eventName => {
        control?.addEventListener(eventName, () => {
            if (syncingHeroControls) return;
            handler();
        });
    });
}



// Mouse and touch move/end events
window.addEventListener("mousemove", (event) => {
    onHeroDragMove(event);
    onHeroResizeMove(event);
});
window.addEventListener("mouseup", stopHeroInteraction);
window.addEventListener("touchmove", (event) => {
    onHeroDragMove(event);
    onHeroResizeMove(event);
}, { passive: false });
window.addEventListener("touchend", stopHeroInteraction);
window.addEventListener("touchcancel", stopHeroInteraction);

/* ===== CORE VISUAL EDITOR FUNCTIONS ===== */
function getItems() {
  if (menuItemsCache.length > 0) {
    return menuItemsCache.map(item => ({
      ...item,
      category: categoryOverrides[item.category] || item.category
    }));
  }
  if (!hasAttemptedSupabaseLoad) {
    return menuData.restaurant || [];
  }
  return [];
}

async function loadDataFromSupabaseAdmin() {
  hasAttemptedSupabaseLoad = true;
  if (!window.sb) return;

  try {
    const [menuItems, configData, catOverrides] = await Promise.all([
      sbGetMenuItems(),
      sbGetConfig(),
      sbGetCategoryOverrides()
    ]);

    if (menuItems && menuItems.length > 0) {
      menuItemsCache = menuItems.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }

    if (configData) {
      Object.assign(CONFIG, configData);
    }

    if (catOverrides) {
      categoryOverrides = catOverrides;
    }

    renderCategories();
    renderMenu();
    applyBrand();
  } catch (e) {
    console.error("Failed to load from Supabase (admin):", e);
  }
}

function addCacheBuster(url) {
  return url;
}

function applyBrand() {
  // Update hero background
  const heroBgImg = document.querySelector('.hero-clean-bg img');
  if (heroBgImg && CONFIG.heroBg) {
    heroBgImg.src = addCacheBuster(CONFIG.heroBg);
  }

  // Update hero tagline
  const welcomeTagline = document.getElementById('welcomeTagline');
  const heroTagline = document.getElementById('heroTagline');
  if (welcomeTagline) welcomeTagline.textContent = CONFIG.tagline || 'Sip, Savour, Smile';
  if (heroTagline) heroTagline.textContent = CONFIG.tagline || 'Sip, Savour, Smile';

  // Update hero offers
  const heroOffersContainer = document.querySelector('.hero-offers');
  if (heroOffersContainer && Array.isArray(CONFIG.offers) && CONFIG.offers.length > 0) {
    heroOffersContainer.innerHTML = CONFIG.offers.map(offer => `
      <article class="hero-offer" role="listitem">
        <span class="hero-offer-icon" aria-hidden="true">${esc(offer.icon || '🎉')}</span>
        <div class="hero-offer-text">
          <strong>${esc(offer.title || '')}</strong>
          <span>${esc(offer.desc || '')}</span>
        </div>
      </article>
    `).join('');
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

// Override saveItems to use sbSaveAllMenuItems
async function saveItems(items, deletedName = null) {
    // Strip any enriched-only computed fields before saving
    const clean = items.map((item, i) => ({
        name: item.name,
        price: Number(item.price),
        category: item.category,
        image: item.image || '',
        description: item.description || '',
        available: item.available !== false,
        sort_order: i
    }));
    // Update in-memory cache immediately so UI stays responsive
    menuItemsCache = clean;
    // If an item was renamed, delete the old DB row first
    if (deletedName) {
        await sbDeleteMenuItem(deletedName).catch(e => console.error('Failed to delete old item row:', e));
    }
    // Persist to Supabase and wait for completion
    const saveSuccess = await sbSaveAllMenuItems(clean).catch(e => {
        console.error('Failed to save items to Supabase:', e);
        showToast('⚠️ Save failed — check connection', true);
        return false;
    });
    if (saveSuccess) {
        // After successful save, manually reload to ensure we have the latest data
        await loadDataFromSupabaseAdmin();
    }
}

// Override saveConfig to use sbSaveConfig
async function saveConfig() {
    // Persist config to Supabase
    const saveSuccess = await sbSaveConfig(CONFIG).catch(e => {
        console.error('Failed to save config to Supabase:', e);
        showToast('⚠️ Config save failed', true);
        return false;
    });
    if (saveSuccess) {
        await loadDataFromSupabaseAdmin();
    }
}

/* ===== CORE VISUAL EDITOR FUNCTIONS ===== */

// Renaming categories dynamically
function hookCategoryRenaming() {
    // Override renderCategories to hook events
    const originalRenderCategories = window.renderCategories;
    window.renderCategories = function() {
        originalRenderCategories();
        document.querySelectorAll("#categoryNav .cat-pill").forEach(pill => {
            const catId = pill.dataset.cat;
            if (catId === "all" || catId === "veg") return;
            
            pill.title = "Double-click to rename this category";
            pill.addEventListener("dblclick", (e) => {
                e.stopPropagation();
                // Extract label (strip any emoji)
                const currentLabel = pill.textContent.replace(/^.*? /, "").trim();
                const newName = prompt(`Rename category "${currentLabel}" to:`, currentLabel);
                if (newName && newName.trim()) {
                    performCategoryRename(catId, newName.trim());
                }
            });
        });
    };
    // Initialize the hooks initially
    window.renderCategories();
}

async function performCategoryRename(catId, newLabel) {
    const category = CATEGORIES.find(c => c.id === catId);
    if (!category) return;
    const oldLabel = category.label;

    // Update CATEGORIES label
    category.label = newLabel;
    category.match = [newLabel];

    // Save Category Name Overrides
    let categoryOverrides = {};
    try {
        categoryOverrides = JSON.parse(localStorage.getItem("cafeCategoryOverrides") || "{}");
    } catch (e) {}
    categoryOverrides[catId] = newLabel;
    localStorage.setItem("cafeCategoryOverrides", JSON.stringify(categoryOverrides));

    // Persist category override to Supabase
    await sbSaveCategoryOverride(catId, newLabel).catch(e => console.error('Category save failed:', e));

    // Update all matching items categories in Supabase
    const allItems = getItems();
    allItems.forEach(i => {
        if (i.category === oldLabel) i.category = newLabel;
    });
    await saveItems(allItems);

    renderCategories();
    renderMenu();
    showToast(`Category renamed to "${newLabel}"`);
}

// Reordering items dynamically (swap positions in the current array list)
async function shiftItemOrder(itemName, direction) {
    const allItems = getItems();
    const index = allItems.findIndex(i => i.name === itemName);
    if (index === -1) return;

    // Find the neighbor in the same category
    const itemCategory = allItems[index].category;
    let neighborIndex = -1;

    if (direction < 0) { // Move up (search backwards)
        for (let i = index - 1; i >= 0; i--) {
            if (allItems[i].category === itemCategory) {
                neighborIndex = i;
                break;
            }
        }
    } else { // Move down (search forwards)
        for (let i = index + 1; i < allItems.length; i++) {
            if (allItems[i].category === itemCategory) {
                neighborIndex = i;
                break;
            }
        }
    }

    if (neighborIndex !== -1) {
        // Swap items
        const temp = allItems[index];
        allItems[index] = allItems[neighborIndex];
        allItems[neighborIndex] = temp;

        await saveItems(allItems);
        renderMenu();
        showToast("Item order updated");
    } else {
        showToast("Item cannot be moved further in this category");
    }
}

/* ===== CRUD ITEM FORM MANAGEMENT ===== */

const itemModal = document.getElementById("adminItemModal");
const itemForm = document.getElementById("adminItemForm");
const itemImageUrlInput = document.getElementById("editItemImage");
const itemImageFileInput = document.getElementById("editItemImageFile");
const clearImageUploadBtn = document.getElementById("clearImageUploadBtn");
const imagePreviewEl = document.getElementById("adminImagePreview");
const imagePreviewImg = document.getElementById("adminImagePreviewImg");
const imagePreviewText = document.getElementById("adminImagePreviewText");
let uploadedImageDataUrl = "";

function setImagePreview(src, message = "Preview will appear here") {
    if (!imagePreviewEl || !imagePreviewImg || !imagePreviewText) return;
    const hasImage = Boolean(src);
    imagePreviewEl.classList.toggle("has-image", hasImage);
    imagePreviewImg.src = hasImage ? addCacheBuster(src) : "";
    imagePreviewText.textContent = hasImage ? "" : message;
}

function clearUploadedImageSelection() {
    uploadedImageDataUrl = "";
    if (itemImageFileInput) itemImageFileInput.value = "";
}

function resetImageInputs() {
    if (itemImageUrlInput) itemImageUrlInput.value = "";
    clearUploadedImageSelection();
    setImagePreview("");
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to read image file"));
        reader.readAsDataURL(file);
    });
}

if (itemImageUrlInput) {
    itemImageUrlInput.addEventListener("input", () => {
        if (uploadedImageDataUrl) return;
        const imageUrl = itemImageUrlInput.value.trim();
        setImagePreview(imageUrl, "Preview will appear here");
    });
}

if (itemImageFileInput) {
    itemImageFileInput.addEventListener("change", async () => {
        const file = itemImageFileInput.files?.[0];
        if (!file) {
            uploadedImageDataUrl = "";
            setImagePreview(itemImageUrlInput?.value.trim(), "Preview will appear here");
            return;
        }
        if (!file.type.startsWith("image/")) {
            clearUploadedImageSelection();
            showToast("Please choose an image file", true);
            return;
        }
        try {
            uploadedImageDataUrl = await readFileAsDataUrl(file);
            setImagePreview(uploadedImageDataUrl);
        } catch (error) {
            clearUploadedImageSelection();
            setImagePreview(itemImageUrlInput?.value.trim(), "Preview will appear here");
            showToast("Could not read the selected image", true);
        }
    });
}

clearImageUploadBtn?.addEventListener("click", () => {
    clearUploadedImageSelection();
    setImagePreview(itemImageUrlInput?.value.trim(), "Preview will appear here");
});

function openItemEditForm(item) {
    document.getElementById("adminModalHeading").textContent = "Edit Menu Item";
    document.getElementById("editItemIndex").value = item.name; // Use unique name as key
    document.getElementById("editItemName").value = item.name;
    document.getElementById("editItemPrice").value = item.price;
    resetImageInputs();
    document.getElementById("editItemImage").value = item.image || "";
    setImagePreview(item.image || "");
    document.getElementById("editItemDesc").value = item.description || "";
    document.getElementById("editItemAvailable").checked = item.available !== false;
    document.getElementById("adminDeleteItemBtn").style.display = "block";

    populateCategoryDropdown(item.category);

    itemModal.classList.add("open");
    itemModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function openItemAddForm() {
    document.getElementById("adminModalHeading").textContent = "Add New Menu Item";
    document.getElementById("editItemIndex").value = ""; // blank signals CREATE
    document.getElementById("editItemName").value = "";
    document.getElementById("editItemPrice").value = "";
    resetImageInputs();
    document.getElementById("editItemDesc").value = "";
    document.getElementById("editItemAvailable").checked = true;
    document.getElementById("adminDeleteItemBtn").style.display = "none";

    populateCategoryDropdown();

    itemModal.classList.add("open");
    itemModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function populateCategoryDropdown(selectedCategory = "") {
    const dropdown = document.getElementById("editItemCategory");
    if (!dropdown) return;
    // window.CATEGORIES is defined in app.js — filter out "All" catch-all entries (match === null)
    const cats = (window.CATEGORIES || []).filter(c => c.match !== null);
    dropdown.innerHTML = cats.map(c =>
        `<option value="${esc(c.label)}"${c.label === selectedCategory ? " selected" : ""}>${esc(c.label)}</option>`
    ).join("");
}

// Save Item Form Handler
if (itemForm) {
    itemForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const originalName = document.getElementById("editItemIndex").value;
        const name = document.getElementById("editItemName").value.trim();
        const price = parseInt(document.getElementById("editItemPrice").value, 10);
        
        if (isNaN(price) || price < 0) {
            showToast("⚠️ Please enter a valid positive price", true);
            return;
        }

        const category = document.getElementById("editItemCategory").value;
        const imageUrl = document.getElementById("editItemImage").value.trim();
        const description = document.getElementById("editItemDesc").value.trim();
        const available = document.getElementById("editItemAvailable").checked;
        const image = uploadedImageDataUrl || imageUrl;

        if (!image) {
            showToast("Add an image link or upload an image", true);
            return;
        }

        const allItems = getItems();

        if (originalName) { // UPDATE
            const idx = allItems.findIndex(i => i.name === originalName);
            if (idx !== -1) {
                allItems[idx] = {
                    ...allItems[idx],
                    name,
                    price,
                    category,
                    image,
                    description,
                    available
                };
            }
            // If the name changed, pass old name so the old DB row gets deleted
            const nameChanged = originalName !== name;
            await saveItems(allItems, nameChanged ? originalName : null);
            showToast("Item updated successfully!");
        } else { // CREATE
            // Check duplicate name
            if (allItems.some(i => i.name.toLowerCase() === name.toLowerCase())) {
                alert("An item with this name already exists.");
                return;
            }
            allItems.push({
                name,
                price,
                category,
                image,
                description,
                available
            });
            await saveItems(allItems);
            showToast("Item added successfully!");
        }

        closeItemForm();
        renderMenu();
    });
}

// Delete Item Button
document.getElementById("adminDeleteItemBtn")?.addEventListener("click", async () => {
    const name = document.getElementById("editItemIndex").value;
    if (!name) return;
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
        const allItems = getItems().filter(i => i.name !== name);
        await saveItems(allItems);
        closeItemForm();
        renderMenu();
        showToast("Item deleted");
    }
});

function closeItemForm() {
    itemModal.classList.remove("open");
    itemModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    resetImageInputs();
}

document.getElementById("adminModalCloseBtn")?.addEventListener("click", closeItemForm);
document.getElementById("adminModalCloseBackdrop")?.addEventListener("click", closeItemForm);


/* ===== SYSTEM SETTINGS FORM MANAGEMENT ===== */

const settingsModal = document.getElementById("adminSettingsModal");
const settingsForm = document.getElementById("adminSettingsForm");

function openSettingsForm() {
    document.getElementById("settingsPhone").value = CONFIG.whatsappPhone || "";
    document.getElementById("settingsTagline").value = CONFIG.tagline || "";
    document.getElementById("settingsGst").value = (CONFIG.gstRate * 100) || 5;
    document.getElementById("settingsPopular").value = (CONFIG.popularItems || []).join(", ");
    document.getElementById("settingsBiryanisComingSoon").checked = CONFIG.biryanisComingSoon !== false;
    document.getElementById("settingsChineseComingSoon").checked = CONFIG.chineseComingSoon !== false;
    document.getElementById("settingsSoupFreeOffer").checked = CONFIG.soupFreeOffer !== false;
    document.getElementById("settingsGstEnabled").checked = CONFIG.gstEnabled === true;
    document.getElementById("settingsWaiterEnabled").checked = CONFIG.waiterEnabled === true;

    settingsModal.classList.add("open");
    settingsModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

if (settingsForm) {
    settingsForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        CONFIG.whatsappPhone = document.getElementById("settingsPhone").value.trim();
        CONFIG.tagline = document.getElementById("settingsTagline").value.trim();
        CONFIG.gstRate = parseFloat(document.getElementById("settingsGst").value) / 100;
        CONFIG.gstEnabled = document.getElementById("settingsGstEnabled").checked;
        CONFIG.popularItems = document.getElementById("settingsPopular").value.split(",").map(i => i.trim()).filter(Boolean);
        CONFIG.biryanisComingSoon = document.getElementById("settingsBiryanisComingSoon").checked;
        CONFIG.chineseComingSoon = document.getElementById("settingsChineseComingSoon").checked;
        CONFIG.soupFreeOffer = document.getElementById("settingsSoupFreeOffer").checked;
        CONFIG.waiterEnabled = document.getElementById("settingsWaiterEnabled").checked;

        await saveConfig();
        applyBrand();
        renderMainCategories();
        renderSubCategories();
        renderMenu();
        closeSettingsForm();
        showToast("System configurations saved!");
    });
}

function closeSettingsForm() {
    settingsModal.classList.remove("open");
    settingsModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

document.getElementById("settingsModalCloseBtn")?.addEventListener("click", closeSettingsForm);
document.getElementById("settingsModalCloseBackdrop")?.addEventListener("click", closeSettingsForm);


/* ===== TOOLBAR BUTTON ACTIONS ===== */

async function resetMenuData() {
    if (confirm("Are you sure you want to reset all modifications? This will clear Supabase data and restore the original menu from local data.")) {
        showToast('Resetting... please wait');
        await sbResetMenuData();
        localStorage.removeItem("cafeCustomThemeColor");
        // Reload page — will re-seed from local data
        window.location.reload();
    }
}

// Note: logoutAdmin() is defined above (line 56) and uses Supabase signOut.
// The duplicate sessionStorage-only version has been removed.

// Escape Key Closes Modals
document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
        if (heroEditorState.isOpen) toggleHeroEditor();
        closeItemForm();
        closeSettingsForm();
    }
});

// Run Login Check on Startup
window.addEventListener("DOMContentLoaded", checkLogin);
