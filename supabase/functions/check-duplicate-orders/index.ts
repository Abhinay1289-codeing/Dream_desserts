// Ambient type declaration for Deno in VS Code TS editor
declare const Deno: any;

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Parse limits or use default 40
    let limit = 40;
    try {
        const body = await req.json();
        if (body.limit) limit = body.limit;
    } catch(e) {
        // body parsing failed, might be a GET request, ignore
    }

    // Fetch the recent orders
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, table_number, customer_name, total, status, created_at, items')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    if (!orders || orders.length === 0) {
      return new Response(JSON.stringify({ duplicates: [], message: 'No recent orders found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    function normalizeItems(items: any): string {
      try {
        const parsed = typeof items === 'string' ? JSON.parse(items) : items;
        if (!Array.isArray(parsed)) return JSON.stringify(items);
        const normalized = parsed.map((item: any) => ({
          name: String(item.name || item.item_name || '').trim(),
          qty: Number(item.qty || item.quantity || 1),
          price: Number(item.price || item.rate || 0)
        })).sort((a: any, b: any) => a.name.localeCompare(b.name));
        return JSON.stringify(normalized);
      } catch {
        return JSON.stringify(items);
      }
    }

    // Process duplicates on the server (offloaded from client)
    const timeDuplicates = [];
    for (let i = 0; i < orders.length; i++) {
      for (let j = i + 1; j < orders.length; j++) {
        const o1 = orders[i];
        const o2 = orders[j];
        
        // Check for identical properties
        if (
          String(o1.table_number || '').trim() === String(o2.table_number || '').trim() && 
          Number(o1.total || 0) === Number(o2.total || 0) && 
          normalizeItems(o1.items) === normalizeItems(o2.items)
        ) {
          const timeDiff = Math.abs(new Date(o1.created_at).getTime() - new Date(o2.created_at).getTime());
          if (timeDiff < 60000) { // Placed within 60 seconds
            timeDuplicates.push({ 
                o1: { id: o1.id, table_number: o1.table_number, total: o1.total, created_at: o1.created_at }, 
                o2: { id: o2.id, table_number: o2.table_number, total: o2.total, created_at: o2.created_at }, 
                timeDiffSec: timeDiff / 1000 
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({ 
        duplicatesCount: timeDuplicates.length,
        duplicates: timeDuplicates,
        ordersChecked: orders.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
