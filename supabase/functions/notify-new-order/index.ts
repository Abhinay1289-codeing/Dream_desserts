// Ambient type declaration for Deno in VS Code TS editor
declare const Deno: any;

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SignJWT, importPKCS8 } from 'https://deno.land/x/jose@v4.14.4/index.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to get Google OAuth access token using a Service Account
async function getAccessToken(clientEmail: string, privateKey: string) {
  const scope = 'https://www.googleapis.com/auth/firebase.messaging'
  // Handle escaped \n characters in private keys from env variables
  const formattedKey = privateKey.replace(/\\n/g, '\n')
  const key = await importPKCS8(formattedKey, 'RS256')
  const jwt = await new SignJWT({ scope })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience('https://oauth2.googleapis.com/token')
    .setExpirationTime('1h')
    .setIssuedAt()
    .sign(key)
    
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  
  const data = await res.json()
  if (!res.ok || !data.access_token) {
    throw new Error(`Google OAuth error: ${data.error_description || data.error || res.statusText}`)
  }
  return data.access_token
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Get the order data from the Postgres Webhook payload or direct POST payload
    const payload = await req.json()
    
    // If sent via DB Webhook, payload.type will be 'INSERT'.
    // If payload contains 'type' and it's not 'INSERT', ignore.
    if (payload.type && payload.type !== 'INSERT') {
      return new Response(
        JSON.stringify({ message: "Not a new order event", type: payload.type }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      )
    }

    // Support both Supabase Postgres Webhook payload (payload.record) and direct JSON body
    const order = payload.record || payload;

    if (!order || typeof order !== 'object') {
      return new Response(
        JSON.stringify({ error: "Invalid or empty order payload" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      )
    }

    // 2. Initialize Supabase client to fetch all logged-in admin devices
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: devices, error: dbError } = await supabase
      .from('admin_devices')
      .select('fcm_token')
      .not('fcm_token', 'is', null)

    if (dbError) {
      throw new Error(`Database query error: ${dbError.message}`)
    }

    const validDevices = (devices || []).filter((d: { fcm_token?: string }) => d.fcm_token && typeof d.fcm_token === 'string' && d.fcm_token.trim().length > 0);

    if (validDevices.length === 0) {
      return new Response(
        JSON.stringify({ message: "No admin devices registered to notify", deviceCount: 0 }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      )
    }

    // 3. Get Firebase credentials from Supabase Secrets
    const serviceAccountStr = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
    if (!serviceAccountStr) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment secret is missing in Supabase Edge Function settings')
    }

    let serviceAccount;
    try {
      serviceAccount = typeof serviceAccountStr === 'string' ? JSON.parse(serviceAccountStr) : serviceAccountStr;
      if (typeof serviceAccount === 'string') {
        serviceAccount = JSON.parse(serviceAccount);
      }
    } catch (parseErr: any) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT JSON parsing error: ${parseErr.message}`)
    }

    if (!serviceAccount.client_email || !serviceAccount.private_key || !serviceAccount.project_id) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT JSON is missing required fields (client_email, private_key, project_id)')
    }

    // 4. Authenticate with Google
    const accessToken = await getAccessToken(serviceAccount.client_email, serviceAccount.private_key)

    // 5. Send FCM message to all devices
    const projectId = serviceAccount.project_id
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`

    const itemsStr = typeof order.items === 'string' ? order.items : JSON.stringify(order.items || []);
    const tableNo = String(order.table_number || order.tableNumber || '');
    const totalAmount = String(order.total || 0);

    const messageTemplate = {
      message: {
        notification: {
          title: "🚨 New Order Received!",
          body: `Table #${tableNo || 'N/A'} - Total: ₹${totalAmount}`
        },
        data: {
          type: "new_order",
          orderId: String(order.id || ''),
          tableNumber: tableNo,
          customerName: String(order.customer_name || order.customerName || 'Guest'),
          customerPhone: String(order.customer_phone || order.customerPhone || ''),
          items: itemsStr,
          subtotal: String(order.subtotal || 0),
          gst: String(order.gst || 0),
          total: totalAmount,
          notes: String(order.notes || ''),
          createdAt: String(order.created_at || order.createdAt || new Date().toISOString())
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'high_importance_channel',
            priority: 'high'
          }
        }
      }
    }

    const results = [];
    for (const device of validDevices) {
      const fcmPayload = {
        message: {
          ...messageTemplate.message,
          token: device.fcm_token
        }
      };
      
      const res = await fetch(fcmUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(fcmPayload)
      });

      const responseBody = await res.json();
      results.push({
        token: device.fcm_token ? `...${device.fcm_token.slice(-8)}` : '',
        status: res.status,
        response: responseBody
      });
    }

    return new Response(
      JSON.stringify({ success: true, notifiedCount: validDevices.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    )
  } catch (error: any) {
    console.error("notify-new-order error:", error)
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    )
  }
})

