require("dotenv").config();

const { createClient } = require("@libsql/client");

// =====================================================
// TURSO DATABASE CONNECTION
// =====================================================

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// =====================================================
// DATABASE HELPERS
// =====================================================

async function run(sql, args = []) {
  return await db.execute({
    sql: sql,
    args: args,
  });
}

async function get(sql, args = []) {
  const result = await db.execute({
    sql: sql,
    args: args,
  });

  return result.rows.length > 0 ? result.rows[0] : null;
}

async function all(sql, args = []) {
  const result = await db.execute({
    sql: sql,
    args: args,
  });

  return result.rows;
}

// =====================================================
// INITIALIZE DATABASE
// =====================================================

async function initializeDatabase() {
  try {
    console.log("Connecting to Turso database...");

    // =================================================
    // USERS
    // =================================================

    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin'
      )
    `);

    // =================================================
    // INGREDIENTS
    // =================================================

    await run(`
      CREATE TABLE IF NOT EXISTS ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        unit TEXT NOT NULL
      )
    `);

    // =================================================
    // RECIPES
    // =================================================

    await run(`
      CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        instructions TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        category TEXT DEFAULT 'Other',
        image TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // =================================================
    // RECIPE INGREDIENTS
    // =================================================

    await run(`
      CREATE TABLE IF NOT EXISTS recipe_ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        recipe_id INTEGER NOT NULL,

        ingredient_id INTEGER NOT NULL,

        quantity REAL NOT NULL,

        unit TEXT NOT NULL,

        FOREIGN KEY (recipe_id)
          REFERENCES recipes(id)
          ON DELETE CASCADE,

        FOREIGN KEY (ingredient_id)
          REFERENCES ingredients(id)
          ON DELETE RESTRICT
      )
    `);

    console.log("Turso database tables are ready.");
  } catch (error) {
    console.error("Database initialization failed:");

    console.error(error);

    throw error;
  }
}

// =====================================================
// DATABASE READY
// =====================================================

const databaseReady = initializeDatabase();

// =====================================================
// EXPORT
// =====================================================

module.exports = {
  db,
  run,
  get,
  all,
  databaseReady,
};
