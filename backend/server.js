require("dotenv").config();

const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { run, get, all, databaseReady } = require("./db");

const app = express();

// =====================================================
// CONFIGURATION
// =====================================================

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
  express.json({
    limit: "15mb",
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "15mb",
  }),
);

// =====================================================
// DATABASE READY MIDDLEWARE
// =====================================================

// Make sure the Turso tables are ready before ANY API
// route tries to access the database.

app.use("/api", async (req, res, next) => {
  try {
    await databaseReady;
    next();
  } catch (error) {
    console.error("Database initialization error:", error);

    return res.status(500).json({
      error: "Database is not available.",
    });
  }
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function getId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.trim().split(/\s+/);

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
}

// =====================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================

function authenticateToken(req, res, next) {
  if (!JWT_SECRET) {
    console.error("JWT_SECRET is missing.");

    return res.status(500).json({
      error: "Server authentication configuration is missing.",
    });
  }

  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({
      error: "Authentication required.",
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    console.error("JWT verification error:", error.message);

    return res.status(401).json({
      error: "Invalid or expired token.",
    });
  }
}

// =====================================================
// API HEALTH CHECK
// =====================================================

app.get("/api", async (req, res) => {
  try {
    res.json({
      message: "Recipe Management System API is running.",
      database: "connected",
    });
  } catch (error) {
    console.error("API health check error:", error);

    res.status(500).json({
      error: "Database connection failed.",
    });
  }
});

// =====================================================
// AUTH - SIGNUP
// =====================================================

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: "Please fill in all required fields.",
      });
    }

    const cleanName = String(name).trim();
    const userEmail = String(email).trim().toLowerCase();
    const userPassword = String(password);

    if (cleanName.length < 2) {
      return res.status(400).json({
        error: "Name must be at least 2 characters.",
      });
    }

    if (!userEmail.includes("@")) {
      return res.status(400).json({
        error: "Please enter a valid email address.",
      });
    }

    if (userPassword.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters.",
      });
    }

    const existingUser = await get(
      `
      SELECT id
      FROM users
      WHERE email = ?
      `,
      [userEmail],
    );

    if (existingUser) {
      return res.status(409).json({
        error: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(userPassword, 10);

    const result = await run(
      `
      INSERT INTO users
      (
        name,
        email,
        password_hash,
        role
      )
      VALUES (?, ?, ?, ?)
      `,
      [cleanName, userEmail, passwordHash, "admin"],
    );

    return res.status(201).json({
      message: "Account created successfully.",
      user: {
        id: Number(result.lastInsertRowid),
        name: cleanName,
        email: userEmail,
        role: "admin",
      },
    });
  } catch (error) {
    console.error("Signup error:", error);

    if (error.message && error.message.toLowerCase().includes("unique")) {
      return res.status(409).json({
        error: "An account with this email already exists.",
      });
    }

    return res.status(500).json({
      error: "Server error while creating account.",
    });
  }
});

// =====================================================
// AUTH - LOGIN
// =====================================================

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Please enter your email and password.",
      });
    }

    const userEmail = String(email).trim().toLowerCase();
    const userPassword = String(password);

    const user = await get(
      `
      SELECT
        id,
        name,
        email,
        password_hash,
        role
      FROM users
      WHERE email = ?
      `,
      [userEmail],
    );

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    const passwordCorrect = await bcrypt.compare(
      userPassword,
      user.password_hash,
    );

    if (!passwordCorrect) {
      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    if (!JWT_SECRET) {
      console.error("JWT_SECRET is missing.");

      return res.status(500).json({
        error: "Server authentication configuration is missing.",
      });
    }

    const token = jwt.sign(
      {
        id: Number(user.id),
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      {
        expiresIn: "2h",
      },
    );

    return res.json({
      message: "Login successful.",
      token,
      user: {
        id: Number(user.id),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      error: "Server error while logging in.",
    });
  }
});

// =====================================================
// AUTH - CURRENT USER
// =====================================================

app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const user = await get(
      `
        SELECT
          id,
          name,
          email,
          role
        FROM users
        WHERE id = ?
        `,
      [req.user.id],
    );

    if (!user) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    return res.json({
      id: Number(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return res.status(500).json({
      error: "Failed to load user.",
    });
  }
});

// =====================================================
// INGREDIENTS - GET ALL
// =====================================================

app.get("/api/ingredients", authenticateToken, async (req, res) => {
  try {
    const ingredients = await all(
      `
        SELECT
          id,
          name,
          unit
        FROM ingredients
        ORDER BY name ASC
        `,
    );

    return res.json(ingredients);
  } catch (error) {
    console.error("Load ingredients error:", error);

    return res.status(500).json({
      error: "Failed to load ingredients.",
    });
  }
});

// =====================================================
// INGREDIENT - GET ONE
// =====================================================

app.get("/api/ingredients/:id", authenticateToken, async (req, res) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({
        error: "Invalid ingredient ID.",
      });
    }

    const ingredient = await get(
      `
        SELECT
          id,
          name,
          unit
        FROM ingredients
        WHERE id = ?
        `,
      [id],
    );

    if (!ingredient) {
      return res.status(404).json({
        error: "Ingredient not found.",
      });
    }

    return res.json({
      id: Number(ingredient.id),
      name: ingredient.name,
      unit: ingredient.unit,
    });
  } catch (error) {
    console.error("Load ingredient error:", error);

    return res.status(500).json({
      error: "Failed to load ingredient.",
    });
  }
});

// =====================================================
// INGREDIENT - CREATE
// =====================================================

app.post("/api/ingredients", authenticateToken, async (req, res) => {
  try {
    const { name, unit } = req.body;

    if (!name || !unit) {
      return res.status(400).json({
        error: "Ingredient name and unit are required.",
      });
    }

    const ingredientName = String(name).trim();
    const ingredientUnit = String(unit).trim();

    if (!ingredientName || !ingredientUnit) {
      return res.status(400).json({
        error: "Ingredient name and unit are required.",
      });
    }

    const existing = await get(
      `
        SELECT id
        FROM ingredients
        WHERE LOWER(name) = LOWER(?)
        `,
      [ingredientName],
    );

    if (existing) {
      return res.status(409).json({
        error: "Ingredient already exists.",
      });
    }

    const result = await run(
      `
        INSERT INTO ingredients
        (
          name,
          unit
        )
        VALUES (?, ?)
        `,
      [ingredientName, ingredientUnit],
    );

    return res.status(201).json({
      id: Number(result.lastInsertRowid),
      name: ingredientName,
      unit: ingredientUnit,
    });
  } catch (error) {
    console.error("Create ingredient error:", error);

    if (error.message && error.message.toLowerCase().includes("unique")) {
      return res.status(409).json({
        error: "Ingredient already exists.",
      });
    }

    return res.status(500).json({
      error: "Failed to create ingredient.",
    });
  }
});

// =====================================================
// INGREDIENT - UPDATE
// =====================================================

app.put("/api/ingredients/:id", authenticateToken, async (req, res) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({
        error: "Invalid ingredient ID.",
      });
    }

    const { name, unit } = req.body;

    if (!name || !unit) {
      return res.status(400).json({
        error: "Ingredient name and unit are required.",
      });
    }

    const ingredientName = String(name).trim();
    const ingredientUnit = String(unit).trim();

    const existing = await get(
      `
        SELECT id
        FROM ingredients
        WHERE id = ?
        `,
      [id],
    );

    if (!existing) {
      return res.status(404).json({
        error: "Ingredient not found.",
      });
    }

    const duplicate = await get(
      `
        SELECT id
        FROM ingredients
        WHERE LOWER(name) = LOWER(?)
        AND id != ?
        `,
      [ingredientName, id],
    );

    if (duplicate) {
      return res.status(409).json({
        error: "Another ingredient with this name already exists.",
      });
    }

    await run(
      `
        UPDATE ingredients
        SET
          name = ?,
          unit = ?
        WHERE id = ?
        `,
      [ingredientName, ingredientUnit, id],
    );

    return res.json({
      id,
      name: ingredientName,
      unit: ingredientUnit,
    });
  } catch (error) {
    console.error("Update ingredient error:", error);

    return res.status(500).json({
      error: "Failed to update ingredient.",
    });
  }
});

// =====================================================
// INGREDIENT - DELETE
// =====================================================

app.delete("/api/ingredients/:id", authenticateToken, async (req, res) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({
        error: "Invalid ingredient ID.",
      });
    }

    const existing = await get(
      `
        SELECT id
        FROM ingredients
        WHERE id = ?
        `,
      [id],
    );

    if (!existing) {
      return res.status(404).json({
        error: "Ingredient not found.",
      });
    }

    await run(
      `
        DELETE FROM ingredients
        WHERE id = ?
        `,
      [id],
    );

    return res.json({
      message: "Ingredient deleted successfully.",
    });
  } catch (error) {
    console.error("Delete ingredient error:", error);

    if (error.message && error.message.toLowerCase().includes("foreign")) {
      return res.status(409).json({
        error: "This ingredient is used in a recipe and cannot be deleted.",
      });
    }

    return res.status(500).json({
      error: "Failed to delete ingredient.",
    });
  }
});

// =====================================================
// RECIPES - GET ALL
// =====================================================

app.get("/api/recipes", authenticateToken, async (req, res) => {
  try {
    const recipes = await all(
      `
        SELECT
          id,
          name,
          description,
          instructions,
          difficulty,
          category,
          image,
          created_at,
          updated_at
        FROM recipes
        ORDER BY id DESC
        `,
    );

    return res.json(
      recipes.map((recipe) => ({
        ...recipe,
        id: Number(recipe.id),
      })),
    );
  } catch (error) {
    console.error("Load recipes error:", error);

    return res.status(500).json({
      error: "Failed to load recipes.",
    });
  }
});

// =====================================================
// RECIPE - GET ONE
// =====================================================

app.get("/api/recipes/:id", authenticateToken, async (req, res) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({
        error: "Invalid recipe ID.",
      });
    }

    const recipe = await get(
      `
        SELECT
          id,
          name,
          description,
          instructions,
          difficulty,
          category,
          image,
          created_at,
          updated_at
        FROM recipes
        WHERE id = ?
        `,
      [id],
    );

    if (!recipe) {
      return res.status(404).json({
        error: "Recipe not found.",
      });
    }

    const ingredients = await all(
      `
        SELECT
          ri.id,
          ri.ingredient_id,
          i.name,
          ri.quantity,
          ri.unit
        FROM recipe_ingredients ri
        JOIN ingredients i
          ON i.id = ri.ingredient_id
        WHERE ri.recipe_id = ?
        ORDER BY ri.id ASC
        `,
      [id],
    );

    return res.json({
      ...recipe,
      id: Number(recipe.id),
      ingredients: ingredients.map((item) => ({
        ...item,
        id: Number(item.id),
        ingredient_id: Number(item.ingredient_id),
        quantity: Number(item.quantity),
      })),
    });
  } catch (error) {
    console.error("Load recipe error:", error);

    return res.status(500).json({
      error: "Failed to load recipe.",
    });
  }
});

// =====================================================
// RECIPE - CREATE
// =====================================================

app.post("/api/recipes", authenticateToken, async (req, res) => {
  try {
    const {
      name,
      description,
      instructions,
      difficulty,
      category,
      image,
      ingredients,
    } = req.body;

    if (!name || !description || !instructions || !difficulty) {
      return res.status(400).json({
        error:
          "Recipe name, description, instructions and difficulty are required.",
      });
    }

    const validDifficulties = ["Easy", "Medium", "Hard"];

    if (!validDifficulties.includes(difficulty)) {
      return res.status(400).json({
        error: "Invalid difficulty level.",
      });
    }

    const recipeName = String(name).trim();
    const recipeDescription = String(description).trim();
    const recipeInstructions = String(instructions).trim();
    const recipeCategory = category ? String(category).trim() : "Other";

    const result = await run(
      `
        INSERT INTO recipes
        (
          name,
          description,
          instructions,
          difficulty,
          category,
          image
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
      [
        recipeName,
        recipeDescription,
        recipeInstructions,
        difficulty,
        recipeCategory,
        image || "",
      ],
    );

    const recipeId = Number(result.lastInsertRowid);

    if (Array.isArray(ingredients)) {
      for (const item of ingredients) {
        const ingredientId = Number(item.ingredient_id);
        const quantity = Number(item.quantity);

        if (
          !Number.isInteger(ingredientId) ||
          ingredientId <= 0 ||
          !Number.isFinite(quantity) ||
          quantity <= 0
        ) {
          continue;
        }

        const ingredientExists = await get(
          `
            SELECT id
            FROM ingredients
            WHERE id = ?
            `,
          [ingredientId],
        );

        if (!ingredientExists) {
          continue;
        }

        await run(
          `
            INSERT INTO recipe_ingredients
            (
              recipe_id,
              ingredient_id,
              quantity,
              unit
            )
            VALUES (?, ?, ?, ?)
            `,
          [
            recipeId,
            ingredientId,
            quantity,
            item.unit ? String(item.unit).trim() : "",
          ],
        );
      }
    }

    return res.status(201).json({
      message: "Recipe created successfully.",
      id: recipeId,
    });
  } catch (error) {
    console.error("Create recipe error:", error);

    return res.status(500).json({
      error: "Failed to create recipe.",
    });
  }
});

// =====================================================
// RECIPE - UPDATE
// =====================================================

app.put("/api/recipes/:id", authenticateToken, async (req, res) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({
        error: "Invalid recipe ID.",
      });
    }

    const {
      name,
      description,
      instructions,
      difficulty,
      category,
      image,
      ingredients,
    } = req.body;

    if (!name || !description || !instructions || !difficulty) {
      return res.status(400).json({
        error:
          "Recipe name, description, instructions and difficulty are required.",
      });
    }

    const validDifficulties = ["Easy", "Medium", "Hard"];

    if (!validDifficulties.includes(difficulty)) {
      return res.status(400).json({
        error: "Invalid difficulty level.",
      });
    }

    const existing = await get(
      `
        SELECT id
        FROM recipes
        WHERE id = ?
        `,
      [id],
    );

    if (!existing) {
      return res.status(404).json({
        error: "Recipe not found.",
      });
    }

    await run(
      `
        UPDATE recipes
        SET
          name = ?,
          description = ?,
          instructions = ?,
          difficulty = ?,
          category = ?,
          image = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
      [
        String(name).trim(),
        String(description).trim(),
        String(instructions).trim(),
        difficulty,
        category ? String(category).trim() : "Other",
        image || "",
        id,
      ],
    );

    await run(
      `
        DELETE FROM recipe_ingredients
        WHERE recipe_id = ?
        `,
      [id],
    );

    if (Array.isArray(ingredients)) {
      for (const item of ingredients) {
        const ingredientId = Number(item.ingredient_id);
        const quantity = Number(item.quantity);

        if (
          !Number.isInteger(ingredientId) ||
          ingredientId <= 0 ||
          !Number.isFinite(quantity) ||
          quantity <= 0
        ) {
          continue;
        }

        const ingredientExists = await get(
          `
            SELECT id
            FROM ingredients
            WHERE id = ?
            `,
          [ingredientId],
        );

        if (!ingredientExists) {
          continue;
        }

        await run(
          `
            INSERT INTO recipe_ingredients
            (
              recipe_id,
              ingredient_id,
              quantity,
              unit
            )
            VALUES (?, ?, ?, ?)
            `,
          [
            id,
            ingredientId,
            quantity,
            item.unit ? String(item.unit).trim() : "",
          ],
        );
      }
    }

    return res.json({
      message: "Recipe updated successfully.",
    });
  } catch (error) {
    console.error("Update recipe error:", error);

    return res.status(500).json({
      error: "Failed to update recipe.",
    });
  }
});

// =====================================================
// RECIPE - DELETE
// =====================================================

app.delete("/api/recipes/:id", authenticateToken, async (req, res) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({
        error: "Invalid recipe ID.",
      });
    }

    const existing = await get(
      `
        SELECT id
        FROM recipes
        WHERE id = ?
        `,
      [id],
    );

    if (!existing) {
      return res.status(404).json({
        error: "Recipe not found.",
      });
    }

    await run(
      `
        DELETE FROM recipes
        WHERE id = ?
        `,
      [id],
    );

    return res.json({
      message: "Recipe deleted successfully.",
    });
  } catch (error) {
    console.error("Delete recipe error:", error);

    return res.status(500).json({
      error: "Failed to delete recipe.",
    });
  }
});

// =====================================================
// DASHBOARD
// =====================================================

app.get("/api/dashboard", authenticateToken, async (req, res) => {
  try {
    const recipeCount = await get(
      `
        SELECT COUNT(*) AS count
        FROM recipes
        `,
    );

    const ingredientCount = await get(
      `
        SELECT COUNT(*) AS count
        FROM ingredients
        `,
    );

    const easyCount = await get(
      `
        SELECT COUNT(*) AS count
        FROM recipes
        WHERE difficulty = 'Easy'
        `,
    );

    const mediumCount = await get(
      `
        SELECT COUNT(*) AS count
        FROM recipes
        WHERE difficulty = 'Medium'
        `,
    );

    const hardCount = await get(
      `
        SELECT COUNT(*) AS count
        FROM recipes
        WHERE difficulty = 'Hard'
        `,
    );

    const recentRecipes = await all(
      `
        SELECT
          id,
          name,
          difficulty,
          category,
          image
        FROM recipes
        ORDER BY id DESC
        LIMIT 3
        `,
    );

    return res.json({
      totalRecipes: Number(recipeCount?.count) || 0,

      totalIngredients: Number(ingredientCount?.count) || 0,

      easyRecipes: Number(easyCount?.count) || 0,

      mediumRecipes: Number(mediumCount?.count) || 0,

      hardRecipes: Number(hardCount?.count) || 0,

      recentRecipes: recentRecipes.map((recipe) => ({
        ...recipe,
        id: Number(recipe.id),
      })),
    });
  } catch (error) {
    console.error("Dashboard error:", error);

    return res.status(500).json({
      error: "Failed to load dashboard statistics.",
    });
  }
});

// =====================================================
// FRONTEND
// =====================================================

const frontendPath = path.join(__dirname, "../frontend");

app.use(express.static(frontendPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "login.html"));
});

// =====================================================
// API 404
// =====================================================

app.use("/api", (req, res) => {
  return res.status(404).json({
    error: "API route not found.",
  });
});

// =====================================================
// GENERAL ERROR HANDLER
// =====================================================

app.use((error, req, res, next) => {
  console.error("Server error:", error);

  return res.status(500).json({
    error: "Internal server error.",
  });
});

// =====================================================
// LOCAL SERVER
// =====================================================

// This runs only when you execute:
// node backend/server.js
//
// Vercel will use module.exports = app instead.

if (require.main === module) {
  databaseReady
    .then(() => {
      app.listen(PORT, () => {
        console.log("=================================");
        console.log(`Recipe Manager running on port ${PORT}`);
        console.log(`http://localhost:${PORT}`);
        console.log("=================================");
      });
    })
    .catch((error) => {
      console.error("Could not start server:", error);
      process.exit(1);
    });
}

// =====================================================
// EXPORT FOR VERCEL
// =====================================================

module.exports = app;
