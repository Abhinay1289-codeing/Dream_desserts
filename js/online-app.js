/**
 * Cafe Coffee Delite - Online Delivery Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
    // --- Android Native App Check ---
    // If launched inside native Android APK (file: protocol or Capacitor WebView), redirect to Admin Orders Dashboard
    if (window.location.protocol === 'file:' || (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) {
        window.location.replace('admin-orders.html');
        return;
    }

    // --- QR Code Redirect ---
    // If a customer scans an old QR code (/?table=11), instantly redirect them to the Dining App
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('table')) {
        window.location.href = '/table.html' + window.location.search;
        return; // Stop execution
    }

    // --- Password Login/Register Logic ---
    const loginOverlay = document.getElementById('customerLoginOverlay');
    const loginError = document.getElementById('customerLoginError');
    
    // Views
    const viewLogin = document.getElementById('authLoginView');
    const viewRegister = document.getElementById('authRegisterView');
    const viewOtp = document.getElementById('authOtpView');

    // Forms
    const loginForm = document.getElementById('customerLoginForm');
    const registerForm = document.getElementById('customerRegisterForm');
    const otpForm = document.getElementById('customerOtpForm');

    // Toggles
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const showLoginBtn = document.getElementById('showLoginBtn');
    const backToLoginBtn = document.getElementById('customerBackToLoginBtn');

    let registeringEmail = '';

    if (loginOverlay) {
        const checkSession = async () => {
            if (window.sb && window.sb.auth) {
                try {
                    const { data: { session } } = await window.sb.auth.getSession();
                    if (session) {
                        loginOverlay.style.display = 'none';
                        return true;
                    }
                } catch (e) {}
            }
            loginOverlay.style.display = 'flex';
            return false;
        };

        await checkSession();
        setTimeout(checkSession, 500);

        // View Toggling
        if (showRegisterBtn) {
            showRegisterBtn.addEventListener('click', () => {
                loginError.classList.add('is-hidden');
                viewLogin.style.display = 'none';
                viewRegister.style.display = 'block';
            });
        }
        if (showLoginBtn) {
            showLoginBtn.addEventListener('click', () => {
                loginError.classList.add('is-hidden');
                viewRegister.style.display = 'none';
                viewLogin.style.display = 'block';
            });
        }
        if (backToLoginBtn) {
            backToLoginBtn.addEventListener('click', () => {
                loginError.classList.add('is-hidden');
                viewOtp.style.display = 'none';
                viewLogin.style.display = 'block';
            });
        }

        // 1. LOGIN
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('loginEmailInput').value.trim();
                const password = document.getElementById('loginPasswordInput').value;
                if (!email || !password) return;
                
                const btn = document.getElementById('customerLoginBtn');
                btn.innerHTML = 'Logging in...';
                btn.disabled = true;
                loginError.classList.add('is-hidden');

                const { error, data } = await window.sb.auth.signInWithPassword({ email, password });
                
                btn.innerHTML = 'Login';
                btn.disabled = false;

                if (error) {
                    loginError.textContent = error.message;
                    loginError.classList.remove('is-hidden');
                } else if (data.session) {
                    loginOverlay.style.display = 'none';
                }
            });
        }

        // 2. REGISTER
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('registerNameInput')?.value.trim() || '';
                const phone = document.getElementById('registerPhoneInput')?.value.trim() || '';
                const email = document.getElementById('registerEmailInput').value.trim();
                const password = document.getElementById('registerPasswordInput').value;
                if (!email || !password) return;

                const btn = document.getElementById('customerRegisterBtn');
                btn.innerHTML = 'Creating...';
                btn.disabled = true;
                loginError.classList.add('is-hidden');

                const { error, data } = await window.sb.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: name,
                            phone: phone
                        }
                    }
                });
                
                btn.innerHTML = 'Create Account';
                btn.disabled = false;

                if (error) {
                    loginError.textContent = error.message;
                    loginError.classList.remove('is-hidden');
                } else {
                    if (name) localStorage.setItem('ccd_profile_name', name);
                    if (phone) localStorage.setItem('ccd_profile_phone', phone);
                    // Check if auto-logged in (email confirmation disabled)
                    if (data.session) {
                        loginOverlay.style.display = 'none';
                    } else {
                        // Email confirmation is required
                        registeringEmail = email;
                        viewRegister.style.display = 'none';
                        viewOtp.style.display = 'block';
                    }
                }
            });
        }

        // 3. VERIFY OTP (During Signup)
        if (otpForm) {
            otpForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const otp = document.getElementById('customerOtpInput').value.trim();
                if (!otp) return;

                const btn = document.getElementById('customerVerifyCodeBtn');
                btn.innerHTML = 'Verifying...';
                btn.disabled = true;
                loginError.classList.add('is-hidden');

                const { data, error } = await window.sb.auth.verifyOtp({
                    email: registeringEmail,
                    token: otp,
                    type: 'signup'
                });

                btn.innerHTML = 'Verify Account';
                btn.disabled = false;

                if (error) {
                    loginError.textContent = error.message;
                    loginError.classList.remove('is-hidden');
                } else if (data.session) {
                    loginOverlay.style.display = 'none';
                }
            });
        }
    }

    // 1. Override the checkout button
    const placeBtn = document.getElementById('placeOrderBtn');
    if (!placeBtn) return;
    
    const newPlaceBtn = placeBtn.cloneNode(true);
    placeBtn.parentNode.replaceChild(newPlaceBtn, placeBtn);

    // 2. Setup Geolocation
    const getLocationBtn = document.getElementById('getLocationBtn');
    const addressInput = document.getElementById('checkoutAddress');
    const latInput = document.getElementById('checkoutLat');
    const lngInput = document.getElementById('checkoutLng');

    // Initialize Google Places Autocomplete if available
    if (window.google && window.google.maps && window.google.maps.places) {
        try {
            if (typeof window.google.maps.places.Autocomplete === 'function') {
                const autocomplete = new window.google.maps.places.Autocomplete(addressInput, {
                    fields: ["formatted_address", "geometry", "name"],
                });
                
                autocomplete.addListener("place_changed", () => {
                    const place = autocomplete.getPlace();
                    if (place.geometry && place.geometry.location) {
                        latInput.value = place.geometry.location.lat();
                        lngInput.value = place.geometry.location.lng();
                        addressInput.value = place.formatted_address || place.name;
                    }
                });
            }
        } catch (e) {
            console.log('[Google Maps Autocomplete] Notice:', e);
        }
        
        // Prevent form submission on Enter key in address field
        addressInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') e.preventDefault();
        });
    }

    getLocationBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
            showToast('Geolocation is not supported by your browser', true);
            return;
        }
        
        getLocationBtn.innerHTML = '⏳ Locating...';
        getLocationBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                latInput.value = lat;
                lngInput.value = lng;
                
                // Use Google Geocoder if available, else fallback to Nominatim
                if (window.google && window.google.maps && window.google.maps.Geocoder) {
                    const geocoder = new window.google.maps.Geocoder();
                    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                        if (status === "OK" && results[0]) {
                            addressInput.value = results[0].formatted_address;
                        } else {
                            addressInput.value = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
                        }
                    });
                } else {
                    // Fallback to Nominatim
                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                        const data = await res.json();
                        if (data && data.display_name) {
                            addressInput.value = data.display_name;
                        } else {
                            addressInput.value = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
                        }
                    } catch (e) {
                        addressInput.value = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
                    }
                }
                
                getLocationBtn.innerHTML = '✅ Location Found';
                getLocationBtn.style.color = '#22c55e';
                getLocationBtn.style.borderColor = '#22c55e';
            },
            (error) => {
                showToast('Unable to retrieve your location', true);
                getLocationBtn.innerHTML = '📍 Use Current Location';
                getLocationBtn.disabled = false;
            },
            { enableHighAccuracy: true }
        );
    });

    // 3. Setup UPI QR Code
    // We need to fetch the UPI ID from config
    let upiId = '';
    if (window.sbGetConfig) {
        const conf = await window.sbGetConfig();
        if (conf && conf.upi_id) {
            upiId = conf.upi_id;
        }
    }
    
    if (!upiId) {
        // Fallback or hide
        document.getElementById('upiQrCode').style.display = 'none';
    }

    // When cart opens, update QR Code
    const proceedCheckoutBtn = document.getElementById('proceedCheckout');
    proceedCheckoutBtn.addEventListener('click', () => {
        if (!upiId || cart.length === 0) return;
        
        let sub = 0;
        cart.forEach(i => { sub += i.price * i.qty; });
        let total = sub;
        if (CONFIG.gstEnabled) {
            total = sub + Math.round(sub * CONFIG.gstRate);
        }
        
        const upiUrl = `upi://pay?pa=${upiId}&pn=Cafe%20Coffee%20Delite&am=${total}&cu=INR`;
        const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(upiUrl)}`;
        
        const qrImg = document.getElementById('upiQrCode');
        qrImg.src = qrApi;
        qrImg.style.display = 'block';
    });

    // 4. Override place order logic
    let _isPlacingOrder = false;

    newPlaceBtn.addEventListener('click', async () => {
        if (_isPlacingOrder) return;
        _isPlacingOrder = true;

        newPlaceBtn.disabled = true;
        newPlaceBtn.textContent = '⏳ Sending Order...';

        if (!cart.length) {
            showToast('⚠️ Your cart is empty', true);
            _isPlacingOrder = false;
            newPlaceBtn.disabled = false;
            newPlaceBtn.textContent = '🚀 Confirm & Send Order to Kitchen';
            return;
        }

        const address = addressInput.value.trim();
        const landmark = document.getElementById('checkoutLandmark').value.trim();
        const name = document.getElementById('checkoutName').value.trim();
        const phone = document.getElementById('checkoutPhone').value.trim();
        const utr = document.getElementById('checkoutUtr').value.trim();
        const notes = document.getElementById('checkoutNotes').value.trim();
        
        const lat = latInput.value || null;
        const lng = lngInput.value || null;

        if (!address || !name || !phone) {
            showToast('⚠️ Please fill required fields (Address, Name, Phone)', true);
            _isPlacingOrder = false;
            newPlaceBtn.disabled = false;
            newPlaceBtn.textContent = '🚀 Confirm & Send Order to Kitchen';
            return;
        }

        // Auto save to profile for future checkouts (both local and Supabase Cloud)
        if (name) localStorage.setItem('ccd_profile_name', name);
        if (phone) localStorage.setItem('ccd_profile_phone', phone);
        if (address) localStorage.setItem('ccd_profile_address', address);

        if (window.sb && window.sb.auth && currentUserSession) {
            window.sb.auth.updateUser({
                data: {
                    full_name: name,
                    phone: phone,
                    address: address
                }
            }).catch(e => console.warn('[SB] Auto profile sync exception:', e));
        }

        // Upload payment proof if provided
        let proofUrl = null;
        const proofFile = document.getElementById('checkoutProof').files[0];
        if (proofFile && window.sb) {
            try {
                // Upload to supabase storage bucket 'receipts'
                const fileExt = proofFile.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                const { data, error } = await sb.storage.from('payment_proofs').upload(fileName, proofFile);
                if (error) throw error;
                
                const { data: { publicUrl } } = sb.storage.from('payment_proofs').getPublicUrl(fileName);
                proofUrl = publicUrl;
            } catch(e) {
                console.error('Proof upload error:', e);
                showToast('Failed to upload payment proof', true);
            }
        }

        // Calculate totals
        let sub = 0;
        const itemsList = cart.map(i => {
            sub += i.price * i.qty;
            return { name: i.name, original_name: i.original_name || i.name, qty: i.qty, price: i.price };
        });
        const gstAmt = CONFIG.gstEnabled ? Math.round(sub * CONFIG.gstRate) : 0;
        const total = sub + gstAmt;

        try {
            if (window.sb) {
                const ok = await window.sbSaveOrder({
                    order_type: 'online',
                    user_id: currentUserSession && currentUserSession.user ? currentUserSession.user.id : null,
                    tableNumber: 'Online',
                    customerName: name,
                    customerPhone: phone,
                    address: address,
                    landmark: landmark,
                    latitude: lat ? parseFloat(lat) : null,
                    longitude: lng ? parseFloat(lng) : null,
                    utr_number: utr || null,
                    payment_proof_url: proofUrl,
                    items: itemsList,
                    subtotal: sub,
                    gst: gstAmt,
                    total: total,
                    notes: notes || null
                });
                if (!ok) throw new Error("Database rejected order");
            }
        } catch (e) {
            console.error('[SB] Failed to save order:', e);
            showToast("⚠️ Failed to place order. Please try again.", true);
            _isPlacingOrder = false;
            newPlaceBtn.disabled = false;
            newPlaceBtn.textContent = '🚀 Confirm & Send Order to Kitchen';
            return;
        }

        // Update Success Screen
        const successBadge = document.getElementById('successTableBadge');
        if (successBadge) successBadge.textContent = 'Delivery Order';
        
        const successItems = document.getElementById('successOrderItems');
        if (successItems) {
            const itemsHtml = itemsList.map(i => `<div>${i.qty}× ${esc(i.name)} — ₹${i.price * i.qty}</div>`).join('');
            successItems.innerHTML = itemsHtml + `<div style="font-weight:800; color:var(--text); margin-top:6px; padding-top:6px; border-top:1px dashed var(--border);">Total: ₹${total}</div>`;
        }

        newPlaceBtn.disabled = false;
        newPlaceBtn.textContent = '🚀 Confirm & Send Order to Kitchen';

        cart = [];
        if(window.updateCartUI) updateCartUI();

        if(window.closeScreens) closeScreens();
        
        const successScreen = document.getElementById('screenSuccess');
        if (successScreen) {
            successScreen.classList.add('open');
            successScreen.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }

        showToast('🎉 Order sent!');
        if(window.launchConfetti) launchConfetti();
        if(window.startOrderTracking) startOrderTracking();
        loadCustomerOrders();

        setTimeout(() => { _isPlacingOrder = false; }, 2000);
    });

    // --- USER SESSION & PROFILE ---
    let currentUserSession = null;

    // Instant local check on startup to prevent login modal flash/erasure on reload
    const storedAuthActive = localStorage.getItem('ccd_customer_logged_in');
    if (storedAuthActive === 'true' && loginOverlay) {
        loginOverlay.style.display = 'none';
    }

    const updateCustomerUI = (session) => {
        currentUserSession = session;
        if (session && session.user) {
            localStorage.setItem('ccd_customer_logged_in', 'true');
            if (loginOverlay) loginOverlay.style.display = 'none';
            const email = session.user.email || 'Customer Account';
            const emailEl = document.getElementById('profileAccountEmail');
            if (emailEl) emailEl.textContent = email;
            loadProfileFields();
            loadCustomerOrders();
        } else {
            localStorage.removeItem('ccd_customer_logged_in');
            if (loginOverlay) loginOverlay.style.display = 'flex';
        }
    };

    if (window.sb && window.sb.auth) {
        window.sb.auth.onAuthStateChange((event, session) => {
            updateCustomerUI(session);
        });

        window.sb.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                updateCustomerUI(session);
            } else if (storedAuthActive !== 'true') {
                if (loginOverlay) loginOverlay.style.display = 'flex';
            }
        });
    }

    // --- LOGOUT ACTION ---
    const logoutBtn = document.getElementById('customerLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (window.sb && window.sb.auth) {
                await window.sb.auth.signOut();
            }
            currentUserSession = null;
            localStorage.removeItem('ccd_customer_logged_in');
            if (window.closeScreens) window.closeScreens();
            if (loginOverlay) loginOverlay.style.display = 'flex';
            showToast('🚪 Logged out successfully');
        });
    }

    // --- HEADER BUTTON LISTENERS ---
    const btnMyOrders = document.getElementById('headerMyOrdersBtn');
    if (btnMyOrders) {
        btnMyOrders.addEventListener('click', () => {
            if (window.closeScreens) window.closeScreens();
            const screen = document.getElementById('screenMyOrders');
            if (screen) {
                screen.classList.add('open');
                screen.setAttribute('aria-hidden', 'false');
                document.body.style.overflow = 'hidden';
            }
            loadCustomerOrders();
        });
    }

    // --- PROFILE AUTO PRE-FILL & SAVING ---
    const loadProfileFields = () => {
        const meta = (currentUserSession && currentUserSession.user && currentUserSession.user.user_metadata) ? currentUserSession.user.user_metadata : {};
        const savedName = meta.full_name || localStorage.getItem('ccd_profile_name') || '';
        const savedPhone = meta.phone || localStorage.getItem('ccd_profile_phone') || '';
        const savedAddress = meta.address || localStorage.getItem('ccd_profile_address') || '';

        const inputName = document.getElementById('profileNameInput');
        const inputPhone = document.getElementById('profilePhoneInput');
        const inputAddress = document.getElementById('profileAddressInput');

        if (inputName) inputName.value = savedName;
        if (inputPhone) inputPhone.value = savedPhone;
        if (inputAddress) inputAddress.value = savedAddress;

        // Auto pre-fill checkout form inputs
        const checkName = document.getElementById('checkoutName');
        const checkPhone = document.getElementById('checkoutPhone');
        const checkAddr = document.getElementById('checkoutAddress');

        if (checkName && savedName && !checkName.value) checkName.value = savedName;
        if (checkPhone && savedPhone && !checkPhone.value) checkPhone.value = savedPhone;
        if (checkAddr && savedAddress && !checkAddr.value) checkAddr.value = savedAddress;
    };

    setTimeout(loadProfileFields, 300);

    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = (document.getElementById('profileNameInput')?.value || '').trim();
            const phone = (document.getElementById('profilePhoneInput')?.value || '').trim();
            const address = (document.getElementById('profileAddressInput')?.value || '').trim();

            localStorage.setItem('ccd_profile_name', name);
            localStorage.setItem('ccd_profile_phone', phone);
            localStorage.setItem('ccd_profile_address', address);

            const saveBtn = document.getElementById('saveProfileBtn');
            if (saveBtn) { saveBtn.innerHTML = '⏳ Syncing to Supabase Cloud...'; saveBtn.disabled = true; }

            if (window.sb && window.sb.auth && currentUserSession) {
                try {
                    const { data, error } = await window.sb.auth.updateUser({
                        data: {
                            full_name: name,
                            phone: phone,
                            address: address
                        }
                    });
                    if (error) {
                        console.error('[SB] Profile cloud save error:', error.message);
                    } else if (data && data.user) {
                        currentUserSession.user = data.user;
                    }
                } catch (err) {
                    console.error('[SB] Profile update exception:', err);
                }
            }

            if (saveBtn) { saveBtn.innerHTML = '💾 Save Profile Details'; saveBtn.disabled = false; }
            loadProfileFields();
            showToast('☁️ Profile permanently saved to Supabase Cloud!');
        });
    }

    const btnProfile = document.getElementById('headerProfileBtn');
    if (btnProfile) {
        btnProfile.addEventListener('click', () => {
            if (window.closeScreens) window.closeScreens();
            const screen = document.getElementById('screenCustomerProfile');
            if (screen) {
                screen.classList.add('open');
                screen.setAttribute('aria-hidden', 'false');
                document.body.style.overflow = 'hidden';
            }
            if (currentUserSession && currentUserSession.user) {
                const emailEl = document.getElementById('profileAccountEmail');
                if (emailEl) emailEl.textContent = currentUserSession.user.email || 'Customer Account';
            }
            loadProfileFields();
        });
    }

    // --- REALTIME CUSTOMER ORDER TRACKER & HISTORY ---
    async function loadCustomerOrders() {
        const activeListEl = document.getElementById('myOrdersActiveList');
        const historyListEl = document.getElementById('myOrdersHistoryList');
        const badgeEl = document.getElementById('myOrdersBadge');
        if (!activeListEl || !historyListEl) return;

        const meta = (currentUserSession && currentUserSession.user && currentUserSession.user.user_metadata) ? currentUserSession.user.user_metadata : {};
        const userId = currentUserSession && currentUserSession.user ? currentUserSession.user.id : null;
        const phone = document.getElementById('checkoutPhone')?.value || meta.phone || localStorage.getItem('ccd_profile_phone') || null;

        if (window.sbGetCustomerOrders) {
            const orders = await window.sbGetCustomerOrders(phone, userId);
            
            const activeOrders = orders.filter(o => o.status !== 'billed' && o.status !== 'cancelled');
            const historyOrders = orders.filter(o => o.status === 'billed' || o.status === 'cancelled');

            // Update badge
            if (badgeEl) {
                if (activeOrders.length > 0) {
                    badgeEl.textContent = activeOrders.length;
                    badgeEl.style.display = 'block';
                } else {
                    badgeEl.style.display = 'none';
                }
            }

            // Render Active Orders Cards (Swiggy / Zomato style live status)
            if (activeOrders.length === 0) {
                activeListEl.innerHTML = `<div style="text-align:center; padding:24px; color:var(--muted); background:var(--card); border:1px dashed var(--border); border-radius:16px;">🛵 No active orders in progress right now.</div>`;
            } else {
                activeListEl.innerHTML = activeOrders.map(ord => {
                    const status = ord.status || 'pending';
                    
                    let statusLabel = '📝 Order Received';
                    let stepClass1 = 'active';
                    let stepClass2 = '';
                    let stepClass3 = '';
                    let stepClass4 = '';
                    let stepClass5 = '';
                    let reachedBannerHtml = '';

                    if (status === 'preparing') {
                        statusLabel = '🍳 Preparing your food...';
                        stepClass1 = 'active';
                        stepClass2 = 'active';
                    } else if (status === 'ready') {
                        statusLabel = '🛵 Out for Delivery!';
                        stepClass1 = 'active';
                        stepClass2 = 'active';
                        stepClass3 = 'active';
                    } else if (status === 'reached') {
                        statusLabel = '📍 Driver Reached Location!';
                        stepClass1 = 'active';
                        stepClass2 = 'active';
                        stepClass3 = 'active';
                        stepClass4 = 'active';
                        reachedBannerHtml = `
                            <div style="background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.4); border-radius: 12px; padding: 12px; margin-top: 10px; text-align: center;">
                                <div style="font-weight: 800; color: #a78bfa; font-size: 0.95rem;">📍 Driver Has Arrived at Your Location!</div>
                                <div style="font-size: 0.8rem; color: var(--text); margin-top: 2px;">Your delivery agent is waiting with your fresh food.</div>
                                <button type="button" class="btn-primary" style="margin-top: 10px; width: 100%; background: #22c55e; border-color: #22c55e; font-size: 0.88rem; font-weight:800;" onclick="confirmCustomerReceipt('${ord.id}')">
                                    ✅ I Received My Order
                                </button>
                            </div>
                        `;
                    } else if (status === 'served') {
                        statusLabel = '🎉 Delivered!';
                        stepClass1 = 'active';
                        stepClass2 = 'active';
                        stepClass3 = 'active';
                        stepClass4 = 'active';
                        stepClass5 = 'active';
                    }

                    const itemsStr = (ord.items || []).map(i => `${i.qty || 1}× ${esc(i.name)}`).join(', ');
                    const dateStr = ord.created_at ? new Date(ord.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';

                    return `
                        <div style="background: var(--card); border: 1px solid var(--border); border-radius: 18px; padding: 18px; margin-bottom: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                                <div>
                                    <span style="font-weight:900; font-size:1rem; color:var(--text);">Order #${String(ord.id || '').substring(0,6).toUpperCase()}</span>
                                    <span style="font-size:0.75rem; color:var(--muted); margin-left:8px;">${dateStr}</span>
                                </div>
                                <span style="background:rgba(245, 158, 11, 0.15); color:#f59e0b; font-size:0.78rem; font-weight:800; padding:4px 10px; border-radius:12px; border:1px solid rgba(245, 158, 11, 0.3);">${statusLabel}</span>
                            </div>

                            <!-- Live Progress Step Bar -->
                            <div style="display:flex; justify-content:space-between; margin:16px 0 12px; position:relative; padding:0 4px;">
                                <div style="display:flex; flex-direction:column; align-items:center; gap:4px; font-size:0.65rem; font-weight:700; color: ${stepClass1 ? '#22c55e' : 'var(--muted)'};">
                                    <span style="font-size:1.1rem;">📝</span>
                                    <span>Received</span>
                                </div>
                                <div style="display:flex; flex-direction:column; align-items:center; gap:4px; font-size:0.65rem; font-weight:700; color: ${stepClass2 ? '#22c55e' : 'var(--muted)'};">
                                    <span style="font-size:1.1rem;">🍳</span>
                                    <span>Preparing</span>
                                </div>
                                <div style="display:flex; flex-direction:column; align-items:center; gap:4px; font-size:0.65rem; font-weight:700; color: ${stepClass3 ? '#22c55e' : 'var(--muted)'};">
                                    <span style="font-size:1.1rem;">🛵</span>
                                    <span>On Way</span>
                                </div>
                                <div style="display:flex; flex-direction:column; align-items:center; gap:4px; font-size:0.65rem; font-weight:700; color: ${stepClass4 ? '#8b5cf6' : 'var(--muted)'};">
                                    <span style="font-size:1.1rem;">📍</span>
                                    <span>Reached</span>
                                </div>
                                <div style="display:flex; flex-direction:column; align-items:center; gap:4px; font-size:0.65rem; font-weight:700; color: ${stepClass5 ? '#22c55e' : 'var(--muted)'};">
                                    <span style="font-size:1.1rem;">🎉</span>
                                    <span>Delivered</span>
                                </div>
                            </div>

                            ${reachedBannerHtml}

                            <div style="font-size:0.85rem; color:var(--text); font-weight:600; padding:10px 0; border-top:1px dashed var(--border); border-bottom:1px dashed var(--border); margin-top:10px; margin-bottom:10px;">
                                ${esc(itemsStr)}
                            </div>

                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.9rem;">
                                <span style="color:var(--muted); font-size:0.8rem;">📍 ${esc(ord.address || 'Delivery')}</span>
                                <span style="font-weight:900; color:#22c55e; font-size:1.05rem;">₹${ord.total}</span>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            // Render History List
            if (historyOrders.length === 0) {
                historyListEl.innerHTML = `<div style="text-align:center; padding:16px; color:var(--muted);">No past orders found.</div>`;
            } else {
                historyListEl.innerHTML = historyOrders.map(ord => {
                    const itemsStr = (ord.items || []).map(i => `${i.qty || 1}× ${esc(i.name)}`).join(', ');
                    const dateStr = ord.created_at ? new Date(ord.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                    const isCancelled = ord.status === 'cancelled';
                    return `
                        <div style="background:var(--card); border:1px solid var(--border); border-radius:14px; padding:14px; margin-bottom:10px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                <span style="font-size:0.82rem; font-weight:700; color:var(--muted);">📅 ${dateStr}</span>
                                <span style="font-size:0.75rem; font-weight:800; color:${isCancelled ? '#ef4444' : '#22c55e'}; background:${isCancelled ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)'}; padding:2px 8px; border-radius:10px;">${isCancelled ? 'Cancelled' : 'Completed ₹' + ord.total}</span>
                            </div>
                            <div style="font-size:0.85rem; font-weight:600; color:var(--text); line-height:1.4;">${esc(itemsStr)}</div>
                        </div>
                    `;
                }).join('');
            }
        }
    }

    if (window.sbSubscribeOrderChanges) {
        window.sbSubscribeOrderChanges(() => {
            loadCustomerOrders();
        });
    }
});

window.confirmCustomerReceipt = async function(orderId) {
    if (!orderId || !window.sbUpdateOrderStatus) return;
    showToast('⏳ Confirming order receipt...');
    const ok = await window.sbUpdateOrderStatus(orderId, 'served');
    if (ok) {
        showToast('🎉 Thank you! Enjoy your meal!');
        if (window.launchConfetti) window.launchConfetti();
    } else {
        showToast('❌ Failed to update status', true);
    }
};
