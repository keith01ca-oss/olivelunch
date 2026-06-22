ALTER TABLE menus DROP CONSTRAINT IF EXISTS menus_date_dish_id_key; ALTER TABLE menus ADD CONSTRAINT menus_date_dish_id_org_id_key UNIQUE (date, dish_id, org_id);
