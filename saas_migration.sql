-- ==============================================================================
-- SAAS MULTI-TENANCY & RECIPE MIGRATION
-- ==============================================================================

-- 1. Create Organizations Table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_org_id VARCHAR UNIQUE, -- Link to Clerk Organization
    name VARCHAR NOT NULL,
    slug VARCHAR UNIQUE NOT NULL,
    stripe_customer_id VARCHAR UNIQUE,
    stripe_subscription_id VARCHAR,
    stripe_subscription_status VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Recipes Table
CREATE TABLE recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    ingredients JSONB DEFAULT '[]'::jsonb,
    instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add Default Organization (for existing data)
INSERT INTO organizations (name, slug) VALUES ('Olive Lunch Master', 'olive-lunch');

-- 4. Get the ID of the new organization
DO $$
DECLARE
    default_org_id UUID;
BEGIN
    SELECT id INTO default_org_id FROM organizations WHERE slug = 'olive-lunch' LIMIT 1;

    -- 5. Add org_id to existing tables
    ALTER TABLE schools ADD COLUMN org_id UUID REFERENCES organizations(id);
    UPDATE schools SET org_id = default_org_id;
    ALTER TABLE schools ALTER COLUMN org_id SET NOT NULL;

    ALTER TABLE routes ADD COLUMN org_id UUID REFERENCES organizations(id);
    UPDATE routes SET org_id = default_org_id;
    ALTER TABLE routes ALTER COLUMN org_id SET NOT NULL;

    ALTER TABLE parents ADD COLUMN org_id UUID REFERENCES organizations(id);
    UPDATE parents SET org_id = default_org_id;
    ALTER TABLE parents ALTER COLUMN org_id SET NOT NULL;

    ALTER TABLE dishes ADD COLUMN org_id UUID REFERENCES organizations(id);
    UPDATE dishes SET org_id = default_org_id;
    ALTER TABLE dishes ALTER COLUMN org_id SET NOT NULL;
    ALTER TABLE dishes ADD COLUMN recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL;

    ALTER TABLE menus ADD COLUMN org_id UUID REFERENCES organizations(id);
    UPDATE menus SET org_id = default_org_id;
    -- Note: Menus is a junction table, we might need to adjust unique constraints later

    ALTER TABLE coupons ADD COLUMN org_id UUID REFERENCES organizations(id);
    UPDATE coupons SET org_id = default_org_id;
    ALTER TABLE coupons ALTER COLUMN org_id SET NOT NULL;

    ALTER TABLE orders ADD COLUMN org_id UUID REFERENCES organizations(id);
    UPDATE orders SET org_id = default_org_id;
    ALTER TABLE orders ALTER COLUMN org_id SET NOT NULL;

    ALTER TABLE blocked_dates ADD COLUMN org_id UUID REFERENCES organizations(id);
    UPDATE blocked_dates SET org_id = default_org_id;
    -- Some tables might be global (blocked dates), but usually for SaaS they are per-org.
    
END $$;

-- 6. Enable RLS on new tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- 7. Basic RLS Policies (Update these based on your Clerk role strategy)
CREATE POLICY "Orgs are viewable by their members" ON organizations FOR SELECT USING (true); -- Public read for slugs
CREATE POLICY "Recipes are viewable by organization" ON recipes FOR ALL USING (true); -- Placeholder for service_role/role check
