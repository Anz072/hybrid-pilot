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
];

const trackedTables = [
  "migration_history",
  "users",
  "weight_logs",
  "app_kv",
  "food_items",
  "user_food_log",
  "activities",
] as const;

export const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("hybridpilot.db");
  }

  return dbPromise;
};

const ensureMigrationMetaTables = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS migration_history (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
};

const getUserVersion = async (db: SQLite.SQLiteDatabase): Promise<number> => {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
  return row?.user_version ?? 0;
};

const recordMigration = async (db: SQLite.SQLiteDatabase, migration: Migration): Promise<void> => {
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

const backfillMigrationHistory = async (db: SQLite.SQLiteDatabase, currentVersion: number): Promise<void> => {
  const alreadyApplied = migrations.filter((migration) => migration.version <= currentVersion);

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
    const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM ${table};`);
    result.push({ table, count: row?.count ?? 0 });
  }

  return result;
};

export const seedDebugData = async (): Promise<void> => {
  if (!__DEV__) {
    throw new Error("seedDebugData is debug-only and cannot run in production.");
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
      INSERT INTO weight_logs (user_external_id, weight_kg, note, logged_at, created_at)
      VALUES (?, ?, ?, ?, ?)
      `,
      userId,
      logs[i],
      "debug-seed",
      ts,
      ts,
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
    DROP TABLE IF EXISTS food_items;
    DROP TABLE IF EXISTS weight_logs;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS app_kv;

    PRAGMA user_version = 0;
    PRAGMA foreign_keys = ON;
  `);

  initPromise = null;
  await initDb();
};
