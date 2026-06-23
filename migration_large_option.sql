-- Run this SQL in your Supabase SQL Editor to add large option columns to the dishes and order_items tables.

-- 1. Add columns to the 'dishes' table
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS has_large BOOLEAN DEFAULT FALSE;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS large_name VARCHAR;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS large_price_regular NUMERIC(10,2);
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS large_price_vip NUMERIC(10,2);

-- 2. Add column to the 'order_items' table
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_large BOOLEAN DEFAULT FALSE;

-- 3. Create or replace exec_sql helper function if it's missing (helps with future runs)
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
