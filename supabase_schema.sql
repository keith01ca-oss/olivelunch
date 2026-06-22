-- ==============================================================================
-- OLIVE LUNCH SAAS - SUPABASE SCHEMA & RLS POLICIES
-- Execute this script in your Supabase SQL Editor.
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. TABLE CREATION
-- ==============================================================================

-- PARENTS
CREATE TABLE parents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_user_id VARCHAR UNIQUE NOT NULL,
    stripe_customer_id VARCHAR UNIQUE,
    email VARCHAR UNIQUE NOT NULL,
    name VARCHAR NOT NULL,
    phone VARCHAR,
    is_vip BOOLEAN DEFAULT FALSE,
    referral_code VARCHAR UNIQUE,
    referred_by UUID REFERENCES parents(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SCHOOLS
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL
);

-- ROUTES
CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_number VARCHAR NOT NULL
);

-- SCHOOL_ROUTES
CREATE TABLE school_routes (
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    stop_order INTEGER DEFAULT 0,
    PRIMARY KEY (school_id, route_id)
);

-- CHILDREN
CREATE TABLE children (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
    division VARCHAR NOT NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DISHES (Master List)
CREATE TYPE dish_category AS ENUM ('main', 'side', 'drink', 'snack');

CREATE TABLE dishes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL,
    category dish_category NOT NULL,
    price_regular NUMERIC(10,2) NOT NULL,
    price_vip NUMERIC(10,2) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    recipe_url VARCHAR,
    ingredients JSONB DEFAULT '[]'::jsonb,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MENUS (Daily Assignments)
CREATE TABLE menus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE RESTRICT,
    UNIQUE (date, dish_id) -- Prevent duplicate dish per day
);

-- COUPONS
CREATE TYPE coupon_type AS ENUM ('fixed', 'percentage');

CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR UNIQUE NOT NULL,
    type coupon_type NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    usage_limit INTEGER,
    used_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ORDERS
CREATE TYPE order_status AS ENUM ('pending', 'paid', 'cancelled', 'refunded');

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES children(id) ON DELETE RESTRICT,
    order_date DATE NOT NULL,
    gross_amount NUMERIC(10,2) NOT NULL,
    credit_used NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(10,2) NOT NULL,
    coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
    status order_status NOT NULL DEFAULT 'pending',
    stripe_session_id VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);



-- ORDER_ITEMS
CREATE TYPE delivery_area AS ENUM ('classroom', 'office', 'pickup');

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(10,2) NOT NULL,
    delivery_area delivery_area NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CREDITS
CREATE TYPE credit_source AS ENUM ('referral', 'coupon', 'refund', 'manual', 'season_proration', 'order_usage');

CREATE TABLE credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    source credit_source NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BLOCKED_DATES
CREATE TABLE blocked_dates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE UNIQUE NOT NULL,
    reason VARCHAR NOT NULL
);

-- PRO_D_RANGES
CREATE TABLE pro_d_ranges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    message VARCHAR NOT NULL
);

-- DATE_WARNINGS (non-blocking notices shown to parents on specific dates)
CREATE TABLE date_warnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE UNIQUE NOT NULL,
    message VARCHAR NOT NULL
);

-- ==============================================================================
-- 2. ROW-LEVEL SECURITY (DEFENSE IN DEPTH)
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_d_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE date_warnings ENABLE ROW LEVEL SECURITY;

-- Note: The primary security layer uses Supabase service_role keys server-side
-- while manually verifying Clerk JWT roles and parent_id.
-- These RLS policies act as a defense-in-depth mechanism.

-- Parents: Can read/update their own profile
CREATE POLICY "Parents can read own profile" ON parents
    FOR SELECT USING (id = auth.uid());
CREATE POLICY "Parents can update own profile" ON parents
    FOR UPDATE USING (id = auth.uid());

-- Children: Can read/write their own children
CREATE POLICY "Parents can read own children" ON children
    FOR SELECT USING (parent_id = auth.uid());
CREATE POLICY "Parents can update own children" ON children
    FOR UPDATE USING (parent_id = auth.uid());
CREATE POLICY "Parents can insert own children" ON children
    FOR INSERT WITH CHECK (parent_id = auth.uid());

-- Orders: Can read own orders
CREATE POLICY "Parents can read own orders" ON orders
    FOR SELECT USING (parent_id = auth.uid());

-- Order Items: Can read items for their own orders
CREATE POLICY "Parents can read own order items" ON order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND orders.parent_id = auth.uid()
        )
    );

-- Credits: Can read own ledger
CREATE POLICY "Parents can read own credits" ON credits
    FOR SELECT USING (parent_id = auth.uid());

-- Publicly readable master tables (Selects only, since admin edits are via service_role)
CREATE POLICY "Schools are viewable by everyone" ON schools FOR SELECT USING (true);
CREATE POLICY "Routes are viewable by everyone" ON routes FOR SELECT USING (true);
CREATE POLICY "School routes are viewable by everyone" ON school_routes FOR SELECT USING (true);
CREATE POLICY "Dishes are viewable by everyone" ON dishes FOR SELECT USING (deleted_at IS NULL AND is_active = TRUE);
CREATE POLICY "Menus are viewable by everyone" ON menus FOR SELECT USING (true);
CREATE POLICY "Blocked dates are viewable by everyone" ON blocked_dates FOR SELECT USING (true);
CREATE POLICY "Pro D ranges are viewable by everyone" ON pro_d_ranges FOR SELECT USING (true);
CREATE POLICY "Date warnings are viewable by everyone" ON date_warnings FOR SELECT USING (true);

-- Functions and Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_parents_updated_at BEFORE UPDATE ON parents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_children_updated_at BEFORE UPDATE ON children FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dishes_updated_at BEFORE UPDATE ON dishes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
