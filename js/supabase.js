/**
 * Supabase Client & DB Helpers
 *
 * ================================================================
 *  IMPORTANT: FIRST-TIME SETUP
 *  1. Create a Supabase project at https://supabase.com/dashboard
 *  2. Copy your Project URL and anon/public key from Project Settings → API
 *  3. Run the SQL in `setup.sql` in your Supabase project's SQL Editor
 *     (Dashboard → SQL Editor → New Query → Paste → Run ▶)
 *  4. Configure environment variables (see .env.example for details)
 * ================================================================
 */

const SUPABASE_URL = window.ENV?.SUPABASE_URL || '';
const SUPABASE_KEY = window.ENV?.SUPABASE_KEY || '';

window.sb = null;
let _supaClient = null;

function sbInit() {
    if (_supaClient) return _supaClient;
    const url = window.ENV?.SUPABASE_URL || SUPABASE_URL;
    const key = window.ENV?.SUPABASE_KEY || SUPABASE_KEY;
    if (url && url !== 'YOUR_SUPABASE_URL' && !url.includes('your-project') && key && key !== 'YOUR_SUPABASE_ANON_KEY' && !key.includes('your-anon')) {
        try {
            _supaClient = supabase.createClient(url, key, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                    storageKey: 'restaurant_customer_auth_v1'
                }
            });
            window.sb = _supaClient;
            return _supaClient;
        } catch (e) {
            console.error('[SB] Initialization error:', e);
        }
    }
    return null;
}
sbInit();
window.sbInit = sbInit;

/* ===== MENU ITEMS ===== */

async function sbGetMenuItems() {
    if (!_supaClient) return null;
    const { data, error } = await _supaClient
        .from('menu_items')
        .select('*')
        .order('sort_order', { ascending: true });
    if (error) { console.error('[SB] getMenuItems:', error.message); return null; }
    return data || [];
}

async function sbUpsertMenuItem(item, sortOrder) {
    if (!_supaClient) return false;
    const { error } = await _supaClient.from('menu_items').upsert({
        name: item.name,
        price: Number(item.price),
        category: item.category,
        image: item.image || '',
        description: item.description || '',
        available: item.available !== false,
        sort_order: sortOrder ?? 0
    }, { onConflict: 'name' });
    if (error) { console.error('[SB] upsertMenuItem:', error.message); return false; }
    return true;
}

async function sbDeleteMenuItem(name) {
    if (!_supaClient) return false;
    const { error } = await _supaClient.from('menu_items').delete().eq('name', name);
    if (error) { console.error('[SB] deleteMenuItem:', error.message); return false; }
    return true;
}

async function sbSaveAllMenuItems(items) {
    if (!_supaClient) return false;
    const payload = items.map((item, i) => ({
        name: item.name,
        price: Number(item.price),
        category: item.category,
        image: item.image || '',
        description: item.description || '',
        available: item.available !== false,
        sort_order: i
    }));
    const { error } = await _supaClient.from('menu_items').upsert(payload, { onConflict: 'name' });
    if (error) { console.error('[SB] saveAllMenuItems:', error.message); return false; }
    return true;
}

async function sbSeedMenuIfEmpty(localItems) {
    if (!_supaClient) return false;
    const existing = await sbGetMenuItems();
    if (existing === null || existing.length > 0) return false;
    const payload = localItems.map((item, i) => ({
        name: item.name,
        price: Number(item.price),
        category: item.category,
        image: item.image || '',
        description: item.description || '',
        available: true,
        sort_order: i
    }));
    const { error } = await _supaClient.from('menu_items').insert(payload);
    if (error) { console.error('[SB] seedMenu:', error.message); return false; }
    console.log('✅ Menu seeded to Supabase!');
    return true;
}

/* ===== CONFIG ===== */

async function sbGetConfig() {
    if (!_supaClient) return null;
    const { data, error } = await _supaClient
        .from('config').select('data').eq('id', 1).maybeSingle();
    if (error) { console.error('[SB] getConfig:', error.message); return null; }
    return data?.data || null;
}

async function sbSaveConfig(configData) {
    if (!_supaClient) return false;
    const { error } = await _supaClient
        .from('config').upsert({ id: 1, data: configData });
    if (error) { console.error('[SB] saveConfig:', error.message); return false; }
    return true;
}

async function sbUpsertConfig(updates) {
    if (!_supaClient) return false;
    const current = await sbGetConfig() || {};
    const newData = { ...current, ...updates };
    return await sbSaveConfig(newData);
}
window.sbUpsertConfig = sbUpsertConfig;

/* ===== CATEGORY OVERRIDES ===== */

async function sbGetCategoryOverrides() {
    if (!_supaClient) return {};
    const { data, error } = await _supaClient.from('category_overrides').select('*');
    if (error) { console.error('[SB] getCategoryOverrides:', error.message); return {}; }
    const result = {};
    (data || []).forEach(row => { result[row.cat_id] = row.label; });
    return result;
}

async function sbSaveCategoryOverride(catId, label) {
    if (!_supaClient) return false;
    const { error } = await _supaClient.from('category_overrides').upsert({ cat_id: catId, label });
    if (error) { console.error('[SB] saveCategoryOverride:', error.message); return false; }
    return true;
}

/* ===== ORDERS ===== */

let _lastSavedOrderTime = 0;
let _lastSavedOrderHash = '';

async function sbSaveOrder(orderData) {
    if (!_supaClient) {
        sbInit();
    }
    if (!_supaClient) {
        console.error('[SB] Supabase client not initialized');
        throw new Error('Database connection not initialized. Unable to send order to kitchen server.');
    }

    const currentHash = `${orderData.user_id || orderData.customerPhone || ''}_${orderData.tableNumber}_${orderData.total}_${JSON.stringify(orderData.items)}`;
    const now = Date.now();
    if (currentHash === _lastSavedOrderHash && (now - _lastSavedOrderTime) < 3000) {
        console.warn('[SB] Duplicate order submission prevented by client lock');
        return true;
    }
    _lastSavedOrderHash = currentHash;
    _lastSavedOrderTime = now;

    // Universal core payload (guaranteed to work on ALL Supabase orders schemas)
    const legacyCorePayload = {
        table_number: String(orderData.tableNumber || '').trim(),
        customer_name: orderData.customerName || 'Guest',
        customer_phone: orderData.customerPhone || null,
        items: orderData.items,
        subtotal: Number(orderData.subtotal || 0),
        gst: Number(orderData.gst || 0),
        total: Number(orderData.total || 0),
        notes: orderData.notes || null,
        status: 'pending'
    };

    // Standard payload (includes order_type and optional delivery/payment fields)
    const standardPayload = {
        ...legacyCorePayload,
        order_type: orderData.order_type || 'dining'
    };
    if (orderData.address) standardPayload.address = orderData.address;
    if (orderData.landmark) standardPayload.landmark = orderData.landmark;
    if (orderData.latitude) standardPayload.latitude = orderData.latitude;
    if (orderData.longitude) standardPayload.longitude = orderData.longitude;
    if (orderData.utr_number) standardPayload.utr_number = orderData.utr_number;
    if (orderData.payment_proof_url) standardPayload.payment_proof_url = orderData.payment_proof_url;

    // Full payload including user_id if provided
    const fullPayload = { ...standardPayload };
    if (orderData.user_id) fullPayload.user_id = orderData.user_id;

    // 1. Attempt insert with full payload
    let { data, error } = await _supaClient.from('orders').insert([fullPayload]);

    // 2. Fallback 1: If user_id or extra optional column is missing in DB schema, retry with standardPayload (without user_id)
    if (error && (error.code === 'PGRST204' || (error.message && (error.message.includes('column') || error.message.includes('user_id'))))) {
        console.warn('[SB] Retrying without user_id column...', error.message);
        const retry1 = await _supaClient.from('orders').insert([standardPayload]);
        error = retry1.error;
    }

    // 3. Fallback 2: If order_type or extra columns are ALSO missing in legacy schema, retry with legacyCorePayload
    if (error && (error.code === 'PGRST204' || (error.message && error.message.includes('column')))) {
        console.warn('[SB] Retrying with legacy core payload...', error.message);
        const retry2 = await _supaClient.from('orders').insert([legacyCorePayload]);
        error = retry2.error;
    }

    if (error) {
        console.error('[SB] saveOrder error:', error.message, error.details);
        return null;
    }
    return true;
}

async function sbGetOrders(limit = 200) {
    if (!_supaClient) return [];
    try {
        const { data, error } = await _supaClient
            .from('orders').select('*')
            .order('created_at', { ascending: false }).limit(limit);
        if (error) return [];
        return data || [];
    } catch (e) {
        return [];
    }
}

async function sbGetCustomerOrders(phone, userId) {
    if (!_supaClient) return [];
    const cleanPhone = phone ? String(phone).trim() : null;
    if (!userId && !cleanPhone) return [];

    try {
        let query = _supaClient
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (userId && cleanPhone) {
            query = query.or(`user_id.eq.${userId},customer_phone.eq.${cleanPhone}`);
        } else if (userId) {
            query = query.eq('user_id', userId);
        } else {
            query = query.eq('customer_phone', cleanPhone);
        }

        let { data, error } = await query;

        // Fallback: If user_id column is missing in DB schema cache, retry querying by customer_phone only
        if (error && cleanPhone && (error.code === 'PGRST204' || (error.message && (error.message.includes('user_id') || error.message.includes('column'))))) {
            console.warn('[SB] getCustomerOrders fallback to customer_phone:', error.message);
            const fallback = await _supaClient
                .from('orders')
                .select('*')
                .eq('customer_phone', cleanPhone)
                .order('created_at', { ascending: false })
                .limit(50);
            data = fallback.data;
            error = fallback.error;
        }

        if (error || !data) {
            if (error) console.error('[SB] getCustomerOrders error:', error.message);
            return [];
        }
        return data;
    } catch (e) {
        console.error('[SB] getCustomerOrders exception:', e);
        return [];
    }
}

async function sbUpdateOrderStatus(id, status) {
    if (!_supaClient) return false;
    const { error } = await _supaClient.from('orders').update({ status }).eq('id', id);
    if (error) { console.error('[SB] updateOrderStatus:', error.message); return false; }
    return true;
}

async function sbClearTableOrders(tableNumber) {
    if (!_supaClient) return false;
    const str = String(tableNumber || '').trim();
    let query = _supaClient.from('orders').update({ status: 'billed' }).neq('status', 'billed');
    if (str.startsWith('online_')) {
        query = query.eq('id', str.replace('online_', ''));
    } else {
        query = query.eq('table_number', str);
    }
    const { error } = await query;
    if (error) { console.error('[SB] clearTableOrders:', error.message); return false; }
    return true;
}

async function sbCancelTableOrders(tableNumber) {
    if (!_supaClient) return false;
    const str = String(tableNumber || '').trim();
    let query = _supaClient.from('orders').update({ status: 'cancelled' }).neq('status', 'billed');
    if (str.startsWith('online_')) {
        query = query.eq('id', str.replace('online_', ''));
    } else {
        query = query.eq('table_number', str);
    }
    const { error } = await query;
    if (error) { console.error('[SB] cancelTableOrders:', error.message); return false; }
    return true;
}

/* ===== RESET ===== */

async function sbResetMenuData() {
    if (!_supaClient) return;
    await _supaClient.from('menu_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await _supaClient.from('config').delete().neq('id', 0);
    await _supaClient.from('category_overrides').delete().neq('cat_id', '__none__');
}

async function sbClearAllOrders() {
    if (!_supaClient) return false;
    const { error } = await _supaClient.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) { console.error('[SB] clearAllOrders:', error.message); return false; }
    return true;
}

/* ===== REAL-TIME ===== */

function sbSubscribeMenuChanges(callback) {
    if (!_supaClient) return null;
    return _supaClient.channel('menu_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, callback)
        .subscribe();
}

function sbSubscribeConfigChanges(callback) {
    if (!_supaClient) return null;
    return _supaClient.channel('config_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'config' }, callback)
        .subscribe();
}

function sbSubscribeCategoryOverridesChanges(callback) {
    if (!_supaClient) return null;
    return _supaClient.channel('category_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'category_overrides' }, callback)
        .subscribe();
}

const _activeOrderChannels = {};

function sbSubscribeOrderChanges(callback, customChannelName) {
    if (!_supaClient) return null;
    const channelName = customChannelName || 'orders_realtime_single';
    
    // Clean up previous channel with same name if exists
    if (_activeOrderChannels[channelName]) {
        try {
            _supaClient.removeChannel(_activeOrderChannels[channelName]);
        } catch (e) {}
    }

    try {
        const channel = _supaClient.channel(channelName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, callback);
        channel.subscribe();
        _activeOrderChannels[channelName] = channel;
        return channel;
    } catch (e) {
        console.warn('[SB] Realtime subscribe error:', e);
        return null;
    }
}

/* ===== PUSH NOTIFICATIONS ===== */
async function sbSaveFCMToken(token) {
    if (!_supaClient) sbInit();
    if (!_supaClient || !token) return false;
    const { error } = await _supaClient.from('admin_devices').upsert(
        { fcm_token: token, updated_at: new Date().toISOString() },
        { onConflict: 'fcm_token' }
    );
    if (error) { console.error('[SB] saveFCMToken:', error.message); return false; }
    console.log('[SB] FCM Token saved securely');
    return true;
}
window.sbSaveFCMToken = sbSaveFCMToken;

async function sbRemoveFCMToken(token) {
    if (!_supaClient) sbInit();
    if (!_supaClient || !token) return false;
    const { error } = await _supaClient.from('admin_devices').delete().eq('fcm_token', token);
    if (error) { console.error('[SB] removeFCMToken:', error.message); return false; }
    console.log('[SB] FCM Token removed from admin_devices');
    return true;
}
window.sbRemoveFCMToken = sbRemoveFCMToken;
