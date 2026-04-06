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
];

const trackedTables = [
  "migration_history",
  "users",
  "weight_logs",
  "weight_entries",
  "weight_goals",
  "app_kv",
  "food_items",
  "user_food_favorites",
  "user_food_log",
  "activities",
  "custom_meals",
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
    DROP TABLE IF EXISTS user_food_log;
    DROP TABLE IF EXISTS custom_meals;
    DROP TABLE IF EXISTS food_items;
    DROP TABLE IF EXISTS weight_goals;
    DROP TABLE IF EXISTS weight_entries;
    DROP TABLE IF EXISTS weight_logs;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS app_kv;

    PRAGMA user_version = 0;
    PRAGMA foreign_keys = ON;
  `);

  initPromise = null;
  await initDb();
};
