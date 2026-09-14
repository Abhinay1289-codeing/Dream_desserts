-- ================================================
-- Cafe Coffee Delite — Server-side Price Validation
-- RUN THIS in Supabase SQL Editor
-- ================================================

-- This function recalculates the order totals (subtotal, gst, total) 
-- based on the actual prices in the menu_items table, ignoring the 
-- client-provided prices to prevent manipulation.

CREATE OR REPLACE FUNCTION public.calculate_order_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    item jsonb;
    real_price numeric;
    calculated_subtotal numeric := 0;
    calculated_gst numeric := 0;
    config_data jsonb;
    is_gst_enabled boolean := false;
    gst_rate numeric := 0;
    new_items jsonb := '[]'::jsonb;
    updated_item jsonb;
BEGIN
    -- 1. Fetch GST Configuration from config table (id = 1)
    SELECT data INTO config_data FROM public.config WHERE id = 1 LIMIT 1;
    
    IF config_data IS NOT NULL THEN
        is_gst_enabled := (config_data->>'gstEnabled')::boolean;
        IF is_gst_enabled AND (config_data->>'gstRate') IS NOT NULL THEN
            gst_rate := (config_data->>'gstRate')::numeric;
        END IF;
    END IF;

    -- 2. Iterate through items and calculate subtotal based on real prices
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
        -- Fetch real price from menu_items using original_name (for variants) or name
        SELECT price INTO real_price 
        FROM public.menu_items 
        WHERE name = COALESCE(item->>'original_name', item->>'name')
          AND available = true;
        
        IF real_price IS NULL THEN
            -- Reject order if item doesn't exist or is unavailable to prevent manipulation
            RAISE EXCEPTION 'Item "%" is currently out of stock or does not exist', COALESCE(item->>'original_name', item->>'name');
        END IF;

        -- Update the item JSON to have the correct real price
        updated_item := jsonb_set(item, '{price}', to_jsonb(real_price));
        new_items := new_items || updated_item;

        -- Add to subtotal
        calculated_subtotal := calculated_subtotal + (real_price * (item->>'qty')::numeric);
    END LOOP;

    -- 3. Calculate GST if enabled
    IF is_gst_enabled THEN
        calculated_gst := round(calculated_subtotal * gst_rate);
    END IF;

    -- 4. Overwrite client-provided totals with server-calculated totals
    NEW.items := new_items;
    NEW.subtotal := calculated_subtotal;
    NEW.gst := calculated_gst;
    NEW.total := calculated_subtotal + calculated_gst;

    RETURN NEW;
END;
$$;

-- Drop trigger if it already exists
DROP TRIGGER IF EXISTS enforce_order_totals_trigger ON public.orders;

-- Create the trigger
CREATE TRIGGER enforce_order_totals_trigger
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.calculate_order_totals();
