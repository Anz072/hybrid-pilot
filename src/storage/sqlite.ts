import * as SQLite from "expo-sqlite";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initPromise: Promise<void> | null = null;

type Migration = {
  version: number;
  name: string;
  up: (db: SQLite.SQLiteDatabase) => Promise<void>;
};

export type TableCount = {
  table: string;
  count: number;
};

const migrations: Migration[] = [
  {
    version: 1,
    name: "initial_core_schema",
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          external_id TEXT UNIQUE,
          provider TEXT NOT NULL,
          display_name TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS weight_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_external_id TEXT NOT NULL,
          weight_kg REAL NOT NULL,
          note TEXT,
          logged_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY(user_external_id) REFERENCES users(external_id)
        );

        CREATE TABLE IF NOT EXISTS app_kv (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_weight_logs_user_logged_at
          ON weight_logs(user_external_id, logged_at DESC);
      `);
    },
  },
  {
    version: 2,
    name: "nutrition_and_activity_tables",
    up: async (db) => {
      await db.execAsync(`
      ALTER TABLE users ADD COLUMN email TEXT;
      ALTER TABLE users ADD COLUMN birthdate TEXT;
      ALTER TABLE users ADD COLUMN gender TEXT;
      ALTER TABLE users ADD COLUMN height_cm REAL;
      ALTER TABLE users ADD COLUMN activity_level TEXT;
      ALTER TABLE users ADD COLUMN goal TEXT;
    `);

      await db.execAsync(`
      CREATE TABLE IF NOT EXISTS food_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        serving_size REAL NOT NULL,
        calories REAL NOT NULL,
        protein_g REAL NOT NULL,
        carbs_g REAL NOT NULL,
        fat_g REAL NOT NULL,
        fiber_g REAL,
        created_at TEXT NOT NULL
      );
    `);

      await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_food_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_external_id TEXT NOT NULL,
        food_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        quantity_g REAL NOT NULL,
        meal_type TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_external_id) REFERENCES users(external_id),
        FOREIGN KEY(food_id) REFERENCES food_items(id)
      );
    `);

      await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_user_food_log_user_date
      ON user_food_log(user_external_id, date DESC);
    `);

      await db.execAsync(`
      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_external_id TEXT NOT NULL,
        type TEXT NOT NULL,
        duration_min REAL,
        calories_burned REAL,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_external_id) REFERENCES users(external_id)
      );
    `);

      await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_activities_user_date
      ON activities(user_external_id, date DESC);
    `);
    },
  },
  {
    version: 3,
    name: "user_profile_expansion",
    up: async (db) => {
      await db.execAsync(`
      ALTER TABLE users ADD COLUMN calorieAllowance INTEGER;
    `);
    },
  },
  {
    version: 4,
    name: "user_macro_targets",
    up: async (db) => {
      await db.execAsync(`
      ALTER TABLE users ADD COLUMN proteinG REAL;
      ALTER TABLE users ADD COLUMN carbsG REAL;
      ALTER TABLE users ADD COLUMN fatG REAL;
    `);
    },
  },
  {
    version: 5,
    name: "food_favorites_and_custom_meals",
    up: async (db) => {
      await db.execAsync(`
      ALTER TABLE food_items ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE IF NOT EXISTS custom_meals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_external_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(user_external_id, name),
        FOREIGN KEY(user_external_id) REFERENCES users(external_id)
      );

      CREATE INDEX IF NOT EXISTS idx_custom_meals_user_name
      ON custom_meals(user_external_id, name);
    `);
    },
  },
  {
    version: 6,
    name: "user_training_types",
    up: async (db) => {
      await db.execAsync(`
      ALTER TABLE users ADD COLUMN training_types TEXT;
    `);
    },
  },
  {
    version: 7,
    name: "weight_entries_v2",
    up: async (db) => {
      await db.execAsync(`
      CREATE TABLE IF NOT EXISTS weight_entries (
        id TEXT PRIMARY KEY,
        user_external_id TEXT NOT NULL,
        measured_at TEXT NOT NULL,
        measured_at_local_iso TEXT NOT NULL,
        zone_offset_minutes INTEGER NOT NULL,
        value_kg REAL NOT NULL,
        value_original REAL NOT NULL,
        unit_original TEXT NOT NULL,
        source TEXT NOT NULL,
        notes TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        client_generated_id TEXT NOT NULL,
        device_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        sync_error TEXT,
        FOREIGN KEY(user_external_id) REFERENCES users(external_id)
      );

      CREATE INDEX IF NOT EXISTS idx_weight_entries_user_measured_at
      ON weight_entries(user_external_id, measured_at DESC);

      CREATE INDEX IF NOT EXISTS idx_weight_entries_user_deleted_at
      ON weight_entries(user_external_id, deleted_at);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_weight_entries_user_client_generated_id
      ON weight_entries(user_external_id, client_generated_id);

      INSERT INTO weight_entries (
        id,
        user_external_id,
        measured_at,
        measured_at_local_iso,
        zone_offset_minutes,
        value_kg,
        value_original,
        unit_original,
        source,
        notes,
        tags,
        client_generated_id,
        created_at,
        updated_at,
        deleted_at,
        version,
        sync_status,
        sync_error
      )
      SELECT
        lower(hex(randomblob(16))),
        user_external_id,
        logged_at,
        logged_at,
        0,
        round(weight_kg, 3),
        round(weight_kg, 3),
        'kg',
        'manual',
        note,
        '[]',
        'legacy-' || id,
        created_at,
        created_at,
        NULL,
        1,
        'synced',
        NULL
      FROM weight_logs
      WHERE NOT EXISTS (
        SELECT 1 FROM weight_entries existing
        WHERE existing.user_external_id = weight_logs.user_external_id
      );
    `);
    },
  },
  {
    version: 8,
    name: "weight_goals",
    up: async (db) => {
      await db.execAsync(`
      CREATE TABLE IF NOT EXISTS weight_goals (
        user_external_id TEXT PRIMARY KEY,
        target_weight_kg REAL NOT NULL,
        target_date TEXT,
        goal_band_kg REAL DEFAULT 0.3,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(user_external_id) REFERENCES users(external_id)
      );
    `);
    },
  },
  {
    version: 9,
    name: "food_items_ssot_expansion",
    up: async (db) => {
      await db.execAsync(`
      ALTER TABLE food_items ADD COLUMN source TEXT NOT NULL DEFAULT 'custom';
      ALTER TABLE food_items ADD COLUMN source_id TEXT;
      ALTER TABLE food_items ADD COLUMN barcode TEXT;
      ALTER TABLE food_items ADD COLUMN brand_name TEXT;
      ALTER TABLE food_items ADD COLUMN serving_unit TEXT NOT NULL DEFAULT 'g';
      ALTER TABLE food_items ADD COLUMN image_url TEXT;
      ALTER TABLE food_items ADD COLUMN raw_payload TEXT;
      ALTER TABLE food_items ADD COLUMN updated_at TEXT;

      UPDATE food_items
      SET updated_at = created_at
      WHERE updated_at IS NULL;

      CREATE INDEX IF NOT EXISTS idx_food_items_name
      ON food_items(lower(name));

      CREATE INDEX IF NOT EXISTS idx_food_items_barcode
      ON food_items(barcode);

      CREATE INDEX IF NOT EXISTS idx_food_items_source_source_id
      ON food_items(source, source_id);

      CREATE INDEX IF NOT EXISTS idx_food_items_favorite_name
      ON food_items(is_favorite, name);
    `);
    },
  },
  {
    version: 10,
    name: "food_items_ssot_v2_shape",
    up: async (db) => {
      await db.execAsync(`
      ALTER TABLE food_items ADD COLUMN quantity_value REAL;
      ALTER TABLE food_items ADD COLUMN quantity_unit TEXT;
      ALTER TABLE food_items ADD COLUMN serving_size_value REAL;
      ALTER TABLE food_items ADD COLUMN serving_size_unit TEXT;
      ALTER TABLE food_items ADD COLUMN nutrition_basis TEXT NOT NULL DEFAULT 'serving';
      ALTER TABLE food_items ADD COLUMN sugar_g REAL;
      ALTER TABLE food_items ADD COLUMN salt_g REAL;
      ALTER TABLE food_items ADD COLUMN saturated_fat_g REAL;
      ALTER TABLE food_items ADD COLUMN ingredients_text TEXT;
      ALTER TABLE food_items ADD COLUMN verified INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE food_items ADD COLUMN is_complete INTEGER NOT NULL DEFAULT 0;

      UPDATE food_items
      SET
        serving_size_value = COALESCE(serving_size_value, serving_size),
        serving_size_unit = COALESCE(serving_size_unit, serving_unit),
        nutrition_basis = COALESCE(nutrition_basis, 'serving'),
        verified = CASE WHEN source = 'open_food_facts' THEN 1 ELSE verified END,
        is_complete = CASE
          WHEN calories IS NOT NULL
            AND protein_g IS NOT NULL
            AND carbs_g IS NOT NULL
            AND fat_g IS NOT NULL
          THEN 1
          ELSE is_complete
        END
      WHERE id IS NOT NULL;
    `);
    },
  },
  {
    version: 11,
    name: "user_food_favorites_join_table",
    up: async (db) => {
      await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_food_favorites (
        user_external_id TEXT NOT NULL,
        food_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_external_id, food_id),
        FOREIGN KEY(user_external_id) REFERENCES users(external_id),
        FOREIGN KEY(food_id) REFERENCES food_items(id)
      );

      CREATE INDEX IF NOT EXISTS idx_user_food_favorites_user_created
      ON user_food_favorites(user_external_id, created_at DESC);

      INSERT OR IGNORE INTO user_food_favorites (user_external_id, food_id, created_at)
      SELECT
        u.external_id,
        f.id,
        COALESCE(f.updated_at, f.created_at, datetime('now'))
      FROM food_items f
      CROSS JOIN users u
      WHERE f.is_favorite = 1;
    `);
    },
  },
  {
    version: 12,
    name: "user_food_log_logged_at",
    up: async (db) => {
      await db.execAsync(`
      ALTER TABLE user_food_log ADD COLUMN logged_at TEXT;

      UPDATE user_food_log
      SET logged_at = COALESCE(logged_at, created_at, date || 'T12:00:00.000Z')
      WHERE logged_at IS NULL;

      CREATE INDEX IF NOT EXISTS idx_user_food_log_user_date_logged_at
      ON user_food_log(user_external_id, date DESC, logged_at ASC);
    `);
    },
  },
  {
    version: 13,
    name: "food_items_extended_nutrients",
    up: async (db) => {
      await db.execAsync(`
      ALTER TABLE food_items ADD COLUMN added_sugars_g REAL;
      ALTER TABLE food_items ADD COLUMN water_g REAL;
      ALTER TABLE food_items ADD COLUMN alcohol_g REAL;
      ALTER TABLE food_items ADD COLUMN fat_saturated_g REAL;
      ALTER TABLE food_items ADD COLUMN fat_monounsaturated_g REAL;
      ALTER TABLE food_items ADD COLUMN fat_polyunsaturated_g REAL;
      ALTER TABLE food_items ADD COLUMN fat_trans_g REAL;
      ALTER TABLE food_items ADD COLUMN omega3_g REAL;
      ALTER TABLE food_items ADD COLUMN omega6_g REAL;
      ALTER TABLE food_items ADD COLUMN epa_g REAL;
      ALTER TABLE food_items ADD COLUMN dha_g REAL;
      ALTER TABLE food_items ADD COLUMN ala_g REAL;
      ALTER TABLE food_items ADD COLUMN linoleic_acid_g REAL;
      ALTER TABLE food_items ADD COLUMN alpha_linolenic_acid_g REAL;
      ALTER TABLE food_items ADD COLUMN cholesterol_mg REAL;
      ALTER TABLE food_items ADD COLUMN vitamin_a_ug REAL;
      ALTER TABLE food_items ADD COLUMN vitamin_c_mg REAL;
      ALTER TABLE food_items ADD COLUMN vitamin_d_ug REAL;
      ALTER TABLE food_items ADD COLUMN vitamin_e_mg REAL;
      ALTER TABLE food_items ADD COLUMN vitamin_k_ug REAL;
      ALTER TABLE food_items ADD COLUMN vitamin_k1_ug REAL;
      ALTER TABLE food_items ADD COLUMN vitamin_k2_ug REAL;
      ALTER TABLE food_items ADD COLUMN thiamin_b1_mg REAL;
      ALTER TABLE food_items ADD COLUMN riboflavin_b2_mg REAL;
      ALTER TABLE food_items ADD COLUMN niacin_b3_mg REAL;
      ALTER TABLE food_items ADD COLUMN pantothenic_acid_b5_mg REAL;
      ALTER TABLE food_items ADD COLUMN vitamin_b6_mg REAL;
      ALTER TABLE food_items ADD COLUMN biotin_b7_ug REAL;
      ALTER TABLE food_items ADD COLUMN folate_b9_ug REAL;
      ALTER TABLE food_items ADD COLUMN vitamin_b12_ug REAL;
      ALTER TABLE food_items ADD COLUMN choline_mg REAL;
      ALTER TABLE food_items ADD COLUMN calcium_mg REAL;
      ALTER TABLE food_items ADD COLUMN iron_mg REAL;
      ALTER TABLE food_items ADD COLUMN magnesium_mg REAL;
      ALTER TABLE food_items ADD COLUMN phosphorus_mg REAL;
      ALTER TABLE food_items ADD COLUMN potassium_mg REAL;
      ALTER TABLE food_items ADD COLUMN sodium_mg REAL;
      ALTER TABLE food_items ADD COLUMN zinc_mg REAL;
      ALTER TABLE food_items ADD COLUMN copper_mg REAL;
      ALTER TABLE food_items ADD COLUMN manganese_mg REAL;
      ALTER TABLE food_items ADD COLUMN selenium_ug REAL;
      ALTER TABLE food_items ADD COLUMN iodine_ug REAL;
      ALTER TABLE food_items ADD COLUMN chromium_ug REAL;
      ALTER TABLE food_items ADD COLUMN molybdenum_ug REAL;
      ALTER TABLE food_items ADD COLUMN histidine_g REAL;
      ALTER TABLE food_items ADD COLUMN isoleucine_g REAL;
      ALTER TABLE food_items ADD COLUMN leucine_g REAL;
      ALTER TABLE food_items ADD COLUMN lysine_g REAL;
      ALTER TABLE food_items ADD COLUMN methionine_g REAL;
      ALTER TABLE food_items ADD COLUMN phenylalanine_g REAL;
      ALTER TABLE food_items ADD COLUMN threonine_g REAL;
      ALTER TABLE food_items ADD COLUMN tryptophan_g REAL;
      ALTER TABLE food_items ADD COLUMN valine_g REAL;
      ALTER TABLE food_items ADD COLUMN alanine_g REAL;
      ALTER TABLE food_items ADD COLUMN arginine_g REAL;
      ALTER TABLE food_items ADD COLUMN aspartic_acid_g REAL;
      ALTER TABLE food_items ADD COLUMN cysteine_g REAL;
      ALTER TABLE food_items ADD COLUMN glutamic_acid_g REAL;
      ALTER TABLE food_items ADD COLUMN glycine_g REAL;
      ALTER TABLE food_items ADD COLUMN proline_g REAL;
      ALTER TABLE food_items ADD COLUMN serine_g REAL;
      ALTER TABLE food_items ADD COLUMN tyrosine_g REAL;
      ALTER TABLE food_items ADD COLUMN caffeine_mg REAL;
      ALTER TABLE food_items ADD COLUMN betaine_mg REAL;
      ALTER TABLE food_items ADD COLUMN lutein_zeaxanthin_ug REAL;

      UPDATE food_items
      SET fat_saturated_g = COALESCE(fat_saturated_g, saturated_fat_g)
      WHERE fat_saturated_g IS NULL;
    `);
    },
  },
  {
    version: 14,
    name: "user_settings",
    up: async (db) => {
      await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_external_id TEXT PRIMARY KEY,
        food_diary_start_hour INTEGER NOT NULL DEFAULT 7,
        food_diary_end_hour INTEGER NOT NULL DEFAULT 22,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(user_external_id) REFERENCES users(external_id)
      );
    `);
    },
  },
  {
    version: 15,
    name: "user_settings_daily_calorie_overrides",
    up: async (db) => {
      await db.execAsync(`
      ALTER TABLE user_settings ADD COLUMN daily_calorie_overrides TEXT;
    `);
    },
  },
  {
    version: 16,
    name: "user_quick_food_log",
    up: async (db) => {
      await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_quick_food_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_external_id TEXT NOT NULL,
        date TEXT NOT NULL,
        logged_at TEXT NOT NULL,
        meal_type TEXT,
        name TEXT,
        calories REAL NOT NULL,
        protein_g REAL NOT NULL DEFAULT 0,
        carbs_g REAL NOT NULL DEFAULT 0,
        fat_g REAL NOT NULL DEFAULT 0,
        alcohol_g REAL NOT NULL DEFAULT 0,
        system_calculated_calories REAL,
        is_energy_manually_set INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_external_id) REFERENCES users(external_id)
      );

      CREATE INDEX IF NOT EXISTS idx_user_quick_food_log_user_date
      ON user_quick_food_log(user_external_id, date DESC);
    `);
    },
  },
  {
    version: 17,
    name: "user_recipes",
    up: async (db) => {
      await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_external_id TEXT NOT NULL,
        created_by_user_external_id TEXT NOT NULL,
        linked_food_id INTEGER NOT NULL,
        build_method TEXT NOT NULL DEFAULT 'scratch',
        name TEXT NOT NULL,
        description TEXT,
        link_url TEXT,
        prep_time_min REAL,
        cook_time_min REAL,
        servings REAL NOT NULL DEFAULT 1,
        steps_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(user_external_id) REFERENCES users(external_id),
        FOREIGN KEY(created_by_user_external_id) REFERENCES users(external_id),
        FOREIGN KEY(linked_food_id) REFERENCES food_items(id)
      );

      CREATE INDEX IF NOT EXISTS idx_user_recipes_user_updated
      ON user_recipes(user_external_id, updated_at DESC);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_recipes_linked_food
      ON user_recipes(linked_food_id);

      CREATE TABLE IF NOT EXISTS user_recipe_ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL,
        food_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        amount_unit TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY(recipe_id) REFERENCES user_recipes(id),
        FOREIGN KEY(food_id) REFERENCES food_items(id)
      );

      CREATE INDEX IF NOT EXISTS idx_user_recipe_ingredients_recipe_sort
      ON user_recipe_ingredients(recipe_id, sort_order ASC);
    `);
    },
  },
  {
    version: 18,
    name: "user_protein_focus",
    up: async (db) => {
      await db.execAsync(`
      ALTER TABLE users ADD COLUMN protein_focus TEXT;
    `);
    },
  },
  {
    version: 19,
    name: "food_and_recipe_public_flags",
    up: async (db) => {
      await db.execAsync(`
      ALTER TABLE food_items ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE user_recipes ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
    `);
    },
  },
  {
    version: 20,
    name: "food_items_canonical_cleanup",
    up: async (db) => {
      await db.execAsync(`
      INSERT OR IGNORE INTO user_food_favorites (user_external_id, food_id, created_at)
      SELECT
        u.external_id,
        f.id,
        COALESCE(f.updated_at, f.created_at, datetime('now'))
      FROM food_items f
      CROSS JOIN users u
      WHERE f.is_favorite = 1;
    `);

      await db.execAsync("PRAGMA foreign_keys = OFF;");
      await db.execAsync(`
      DROP TABLE IF EXISTS food_items_next;

      CREATE TABLE food_items_next (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'custom',
        source_id TEXT,
        barcode TEXT,
        brand_name TEXT,
        image_url TEXT,
        raw_payload TEXT,
        updated_at TEXT,
        quantity_value REAL,
        quantity_unit TEXT,
        serving_size_value REAL,
        serving_size_unit TEXT,
        nutrition_basis TEXT NOT NULL DEFAULT 'serving',
        calories REAL NOT NULL,
        protein_g REAL NOT NULL,
        carbs_g REAL NOT NULL,
        fat_g REAL NOT NULL,
        fiber_g REAL,
        sugar_g REAL,
        added_sugars_g REAL,
        water_g REAL,
        alcohol_g REAL,
        salt_g REAL,
        fat_saturated_g REAL,
        fat_monounsaturated_g REAL,
        fat_polyunsaturated_g REAL,
        fat_trans_g REAL,
        omega3_g REAL,
        omega6_g REAL,
        epa_g REAL,
        dha_g REAL,
        ala_g REAL,
        linoleic_acid_g REAL,
        alpha_linolenic_acid_g REAL,
        cholesterol_mg REAL,
        vitamin_a_ug REAL,
        vitamin_c_mg REAL,
        vitamin_d_ug REAL,
        vitamin_e_mg REAL,
        vitamin_k_ug REAL,
        vitamin_k1_ug REAL,
        vitamin_k2_ug REAL,
        thiamin_b1_mg REAL,
        riboflavin_b2_mg REAL,
        niacin_b3_mg REAL,
        pantothenic_acid_b5_mg REAL,
        vitamin_b6_mg REAL,
        biotin_b7_ug REAL,
        folate_b9_ug REAL,
        vitamin_b12_ug REAL,
        choline_mg REAL,
        calcium_mg REAL,
        iron_mg REAL,
        magnesium_mg REAL,
        phosphorus_mg REAL,
        potassium_mg REAL,
        sodium_mg REAL,
        zinc_mg REAL,
        copper_mg REAL,
        manganese_mg REAL,
        selenium_ug REAL,
        iodine_ug REAL,
        chromium_ug REAL,
        molybdenum_ug REAL,
        histidine_g REAL,
        isoleucine_g REAL,
        leucine_g REAL,
        lysine_g REAL,
        methionine_g REAL,
        phenylalanine_g REAL,
        threonine_g REAL,
        tryptophan_g REAL,
        valine_g REAL,
        alanine_g REAL,
        arginine_g REAL,
        aspartic_acid_g REAL,
        cysteine_g REAL,
        glutamic_acid_g REAL,
        glycine_g REAL,
        proline_g REAL,
        serine_g REAL,
        tyrosine_g REAL,
        caffeine_mg REAL,
        betaine_mg REAL,
        lutein_zeaxanthin_ug REAL,
        ingredients_text TEXT,
        verified INTEGER NOT NULL DEFAULT 0,
        is_complete INTEGER NOT NULL DEFAULT 0,
        is_public INTEGER NOT NULL DEFAULT 0
      );

      INSERT INTO food_items_next (
        id,
        name,
        created_at,
        source,
        source_id,
        barcode,
        brand_name,
        image_url,
        raw_payload,
        updated_at,
        quantity_value,
        quantity_unit,
        serving_size_value,
        serving_size_unit,
        nutrition_basis,
        calories,
        protein_g,
        carbs_g,
        fat_g,
        fiber_g,
        sugar_g,
        added_sugars_g,
        water_g,
        alcohol_g,
        salt_g,
        fat_saturated_g,
        fat_monounsaturated_g,
        fat_polyunsaturated_g,
        fat_trans_g,
        omega3_g,
        omega6_g,
        epa_g,
        dha_g,
        ala_g,
        linoleic_acid_g,
        alpha_linolenic_acid_g,
        cholesterol_mg,
        vitamin_a_ug,
        vitamin_c_mg,
        vitamin_d_ug,
        vitamin_e_mg,
        vitamin_k_ug,
        vitamin_k1_ug,
        vitamin_k2_ug,
        thiamin_b1_mg,
        riboflavin_b2_mg,
        niacin_b3_mg,
        pantothenic_acid_b5_mg,
        vitamin_b6_mg,
        biotin_b7_ug,
        folate_b9_ug,
        vitamin_b12_ug,
        choline_mg,
        calcium_mg,
        iron_mg,
        magnesium_mg,
        phosphorus_mg,
        potassium_mg,
        sodium_mg,
        zinc_mg,
        copper_mg,
        manganese_mg,
        selenium_ug,
        iodine_ug,
        chromium_ug,
        molybdenum_ug,
        histidine_g,
        isoleucine_g,
        leucine_g,
        lysine_g,
        methionine_g,
        phenylalanine_g,
        threonine_g,
        tryptophan_g,
        valine_g,
        alanine_g,
        arginine_g,
        aspartic_acid_g,
        cysteine_g,
        glutamic_acid_g,
        glycine_g,
        proline_g,
        serine_g,
        tyrosine_g,
        caffeine_mg,
        betaine_mg,
        lutein_zeaxanthin_ug,
        ingredients_text,
        verified,
        is_complete,
        is_public
      )
      SELECT
        id,
        name,
        created_at,
        source,
        source_id,
        barcode,
        brand_name,
        image_url,
        raw_payload,
        COALESCE(updated_at, created_at),
        quantity_value,
        quantity_unit,
        COALESCE(serving_size_value, serving_size),
        COALESCE(serving_size_unit, serving_unit, 'g'),
        COALESCE(nutrition_basis, 'serving'),
        calories,
        protein_g,
        carbs_g,
        fat_g,
        fiber_g,
        sugar_g,
        added_sugars_g,
        water_g,
        alcohol_g,
        salt_g,
        COALESCE(fat_saturated_g, saturated_fat_g),
        fat_monounsaturated_g,
        fat_polyunsaturated_g,
        fat_trans_g,
        omega3_g,
        omega6_g,
        epa_g,
        dha_g,
        ala_g,
        linoleic_acid_g,
        alpha_linolenic_acid_g,
        cholesterol_mg,
        vitamin_a_ug,
        vitamin_c_mg,
        vitamin_d_ug,
        vitamin_e_mg,
        vitamin_k_ug,
        vitamin_k1_ug,
        vitamin_k2_ug,
        thiamin_b1_mg,
        riboflavin_b2_mg,
        niacin_b3_mg,
        pantothenic_acid_b5_mg,
        vitamin_b6_mg,
        biotin_b7_ug,
        folate_b9_ug,
        vitamin_b12_ug,
        choline_mg,
        calcium_mg,
        iron_mg,
        magnesium_mg,
        phosphorus_mg,
        potassium_mg,
        sodium_mg,
        zinc_mg,
        copper_mg,
        manganese_mg,
        selenium_ug,
        iodine_ug,
        chromium_ug,
        molybdenum_ug,
        histidine_g,
        isoleucine_g,
        leucine_g,
        lysine_g,
        methionine_g,
        phenylalanine_g,
        threonine_g,
        tryptophan_g,
        valine_g,
        alanine_g,
        arginine_g,
        aspartic_acid_g,
        cysteine_g,
        glutamic_acid_g,
        glycine_g,
        proline_g,
        serine_g,
        tyrosine_g,
        caffeine_mg,
        betaine_mg,
        lutein_zeaxanthin_ug,
        ingredients_text,
        COALESCE(verified, 0),
        COALESCE(is_complete, 0),
        COALESCE(is_public, 0)
      FROM food_items;

      DROP TABLE food_items;
      ALTER TABLE food_items_next RENAME TO food_items;

      CREATE INDEX IF NOT EXISTS idx_food_items_name
      ON food_items(lower(name));

      CREATE INDEX IF NOT EXISTS idx_food_items_barcode
      ON food_items(barcode);

      CREATE INDEX IF NOT EXISTS idx_food_items_source_source_id
      ON food_items(source, source_id);
    `);
      await db.execAsync("PRAGMA foreign_keys = ON;");
    },
  },
  {
    version: 21,
    name: "drop_legacy_tables",
    up: async (db) => {
      await db.execAsync(`
      DROP TABLE IF EXISTS custom_meals;
      DROP TABLE IF EXISTS weight_logs;
    `);
    },
  },
];

const trackedTables = [
  "migration_history",
  "users",
  "user_settings",
  "weight_entries",
  "weight_goals",
  "app_kv",
  "food_items",
  "user_food_favorites",
  "user_food_log",
  "user_quick_food_log",
  "user_recipes",
  "user_recipe_ingredients",
  "activities",
] as const;

export const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("hybridpilot.db");
  }

  return dbPromise;
};

const ensureMigrationMetaTables = async (
  db: SQLite.SQLiteDatabase,
): Promise<void> => {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS migration_history (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
};

const getUserVersion = async (db: SQLite.SQLiteDatabase): Promise<number> => {
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version;",
  );
  return row?.user_version ?? 0;
};

const recordMigration = async (
  db: SQLite.SQLiteDatabase,
  migration: Migration,
): Promise<void> => {
  await db.runAsync(
    `
    INSERT OR IGNORE INTO migration_history (version, name, applied_at)
    VALUES (?, ?, ?)
    `,
    migration.version,
    migration.name,
    new Date().toISOString(),
  );
};

const backfillMigrationHistory = async (
  db: SQLite.SQLiteDatabase,
  currentVersion: number,
): Promise<void> => {
  const alreadyApplied = migrations.filter(
    (migration) => migration.version <= currentVersion,
  );

  for (const migration of alreadyApplied) {
    await recordMigration(db, migration);
  }
};

const runMigrations = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  let currentVersion = await getUserVersion(db);

  await backfillMigrationHistory(db, currentVersion);

  for (const migration of sorted) {
    if (migration.version <= currentVersion) {
      continue;
    }

    await migration.up(db);
    await db.execAsync(`PRAGMA user_version = ${migration.version};`);
    await recordMigration(db, migration);
    currentVersion = migration.version;
  }
};

export const initDb = async (): Promise<void> => {
  if (!initPromise) {
    initPromise = (async () => {
      const db = await getDb();
      await db.execAsync("PRAGMA journal_mode = WAL;");
      await ensureMigrationMetaTables(db);
      await runMigrations(db);
    })();
  }

  await initPromise;
};

export const getDebugTableCounts = async (): Promise<TableCount[]> => {
  await initDb();
  const db = await getDb();
  const result: TableCount[] = [];

  for (const table of trackedTables) {
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${table};`,
    );
    result.push({ table, count: row?.count ?? 0 });
  }

  return result;
};

export const seedDebugData = async (): Promise<void> => {
  if (!__DEV__) {
    throw new Error(
      "seedDebugData is debug-only and cannot run in production.",
    );
  }

  await initDb();
  const db = await getDb();
  const now = Date.now();
  const userId = "debug-user";

  await db.runAsync(
    `
    INSERT INTO users (external_id, provider, display_name, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(external_id) DO UPDATE SET display_name = excluded.display_name
    `,
    userId,
    "local",
    "Debug Athlete",
    new Date(now).toISOString(),
  );

  const logs = [84.2, 83.8, 83.5];
  for (let i = 0; i < logs.length; i += 1) {
    const ts = new Date(now - i * 86400000).toISOString();
    await db.runAsync(
      `
      INSERT INTO weight_entries (
        id,
        user_external_id,
        measured_at,
        measured_at_local_iso,
        zone_offset_minutes,
        value_kg,
        value_original,
        unit_original,
        source,
        notes,
        tags,
        client_generated_id,
        created_at,
        updated_at,
        deleted_at,
        version,
        sync_status,
        sync_error
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      `debug-entry-${i}`,
      userId,
      ts,
      ts,
      0,
      logs[i],
      logs[i],
      "kg",
      "manual",
      "debug-seed",
      "[]",
      `debug-entry-${i}`,
      ts,
      ts,
      null,
      1,
      "synced",
      null,
    );
  }
};

export const resetDb = async (): Promise<void> => {
  if (!__DEV__) {
    throw new Error("resetDb is debug-only and cannot run in production.");
  }

  const db = await getDb();

  await db.execAsync(`
    PRAGMA foreign_keys = OFF;

    DROP TABLE IF EXISTS migration_history;
    DROP TABLE IF EXISTS activities;
    DROP TABLE IF EXISTS user_food_favorites;
    DROP TABLE IF EXISTS user_food_log;
    DROP TABLE IF EXISTS user_recipe_ingredients;
    DROP TABLE IF EXISTS user_recipes;
    DROP TABLE IF EXISTS custom_meals;
    DROP TABLE IF EXISTS food_items;
    DROP TABLE IF EXISTS weight_goals;
    DROP TABLE IF EXISTS weight_entries;
    DROP TABLE IF EXISTS weight_logs;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS user_settings;
    DROP TABLE IF EXISTS app_kv;

    PRAGMA user_version = 0;
    PRAGMA foreign_keys = ON;
  `);

  initPromise = null;
  await initDb();
};
