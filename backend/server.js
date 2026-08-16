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
// DATABASE CHECK
// =====================================================

app.get("/api", async (req, res) => {
  try {
    await databaseReady;

    res.json({
      message: "Recipe Management System API is running.",
      database: "connected",
    });
  } catch (error) {
    console.error("Database error:", error);

    res.status(500).json({
      error: "Database connection failed.",
    });
  }
});

// =====================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================

function authenticateToken(req, res, next) {
  if (!JWT_SECRET) {
    return res.status(500).json({
      error: "JWT_SECRET is missing from .env",
    });
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "Authentication required.",
    });
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      error: "Invalid authentication format.",
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      error: "Invalid or expired token.",
    });
  }
}

// =====================================================
// AUTH - SIGNUP
// =====================================================

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // -------------------------------------------------
    // Validation
    // -------------------------------------------------

    if (!name || !email || !password) {
      return res.status(400).json({
        error: "Please fill in all required fields.",
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({
        error: "Name must be at least 2 characters.",
      });
    }

    const userEmail = email.trim().toLowerCase();

    if (!userEmail.includes("@")) {
      return res.status(400).json({
        error: "Please enter a valid email address.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters.",
      });
    }

    // -------------------------------------------------
    // Check existing email
    // -------------------------------------------------

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

    // -------------------------------------------------
    // Hash password
    // -------------------------------------------------

    const passwordHash = await bcrypt.hash(password, 10);

    // -------------------------------------------------
    // Create user
    // -------------------------------------------------

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
      [name.trim(), userEmail, passwordHash, "admin"],
    );

    // -------------------------------------------------
    // Response
    // -------------------------------------------------

    res.status(201).json({
      message: "Account created successfully.",
      user: {
        id: Number(result.lastInsertRowid),
        name: name.trim(),
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

    res.status(500).json({
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

    // -------------------------------------------------
    // Validation
    // -------------------------------------------------

    if (!email || !password) {
      return res.status(400).json({
        error: "Please enter your email and password.",
      });
    }

    const userEmail = email.trim().toLowerCase();

    // -------------------------------------------------
    // Find user
    // -------------------------------------------------

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

    // -------------------------------------------------
    // Check password
    // -------------------------------------------------

    const passwordCorrect = await bcrypt.compare(password, user.password_hash);

    if (!passwordCorrect) {
      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    // -------------------------------------------------
    // Check JWT secret
    // -------------------------------------------------

    if (!JWT_SECRET) {
      console.error("JWT_SECRET is missing from .env");

      return res.status(500).json({
        error: "Server authentication configuration is missing.",
      });
    }

    // -------------------------------------------------
    // Create JWT
    // -------------------------------------------------

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

    // -------------------------------------------------
    // Response
    // -------------------------------------------------

    res.json({
      message: "Login successful.",
      token: token,

      user: {
        id: Number(user.id),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      error: "Server error while logging in.",
    });
  }
});

// =====================================================
// GET CURRENT USER
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

    res.json(user);
  } catch (error) {
    console.error("Get current user error:", error);

    res.status(500).json({
      error: "Failed to load user.",
    });
  }
});

// =====================================================
// INGREDIENTS - GET ALL
// =====================================================

app.get("/api/ingredients", async (req, res) => {
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

    res.json(ingredients);
  } catch (error) {
    console.error("Load ingredients error:", error);

    res.status(500).json({
      error: "Failed to load ingredients.",
    });
  }
});

// =====================================================
// INGREDIENT - GET ONE
// =====================================================

app.get("/api/ingredients/:id", async (req, res) => {
  try {
    const ingredient = await get(
      `
        SELECT
          id,
          name,
          unit
        FROM ingredients
        WHERE id = ?
        `,
      [req.params.id],
    );

    if (!ingredient) {
      return res.status(404).json({
        error: "Ingredient not found.",
      });
    }

    res.json(ingredient);
  } catch (error) {
    console.error(error);

    res.status(500).json({
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

    const ingredientName = name.trim();
    const ingredientUnit = unit.trim();

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

    res.status(201).json({
      id: Number(result.lastInsertRowid),
      name: ingredientName,
      unit: ingredientUnit,
    });
  } catch (error) {
    console.error("Create ingredient error:", error);

    res.status(500).json({
      error: "Failed to create ingredient.",
    });
  }
});

// =====================================================
// INGREDIENT - UPDATE
// =====================================================

app.put("/api/ingredients/:id", authenticateToken, async (req, res) => {
  try {
    const { name, unit } = req.body;

    if (!name || !unit) {
      return res.status(400).json({
        error: "Ingredient name and unit are required.",
      });
    }

    const existing = await get(
      `
        SELECT id
        FROM ingredients
        WHERE id = ?
        `,
      [req.params.id],
    );

    if (!existing) {
      return res.status(404).json({
        error: "Ingredient not found.",
      });
    }

    const ingredientName = name.trim();
    const ingredientUnit = unit.trim();

    await run(
      `
        UPDATE ingredients
        SET
          name = ?,
          unit = ?
        WHERE id = ?
        `,
      [ingredientName, ingredientUnit, req.params.id],
    );

    res.json({
      id: Number(req.params.id),
      name: ingredientName,
      unit: ingredientUnit,
    });
  } catch (error) {
    console.error("Update ingredient error:", error);

    res.status(500).json({
      error: "Failed to update ingredient.",
    });
  }
});

// =====================================================
// INGREDIENT - DELETE
// =====================================================

app.delete("/api/ingredients/:id", authenticateToken, async (req, res) => {
  try {
    const existing = await get(
      `
        SELECT id
        FROM ingredients
        WHERE id = ?
        `,
      [req.params.id],
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
      [req.params.id],
    );

    res.json({
      message: "Ingredient deleted successfully.",
    });
  } catch (error) {
    console.error("Delete ingredient error:", error);

    if (error.message && error.message.toLowerCase().includes("foreign")) {
      return res.status(409).json({
        error: "This ingredient is used in a recipe and cannot be deleted.",
      });
    }

    res.status(500).json({
      error: "Failed to delete ingredient.",
    });
  }
});

// =====================================================
// RECIPES - GET ALL
// =====================================================

app.get("/api/recipes", async (req, res) => {
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

    res.json(recipes);
  } catch (error) {
    console.error("Load recipes error:", error);

    res.status(500).json({
      error: "Failed to load recipes.",
    });
  }
});

// =====================================================
// RECIPE - GET ONE
// =====================================================

app.get("/api/recipes/:id", async (req, res) => {
  try {
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
      [req.params.id],
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
      [req.params.id],
    );

    res.json({
      ...recipe,
      ingredients,
    });
  } catch (error) {
    console.error("Load recipe error:", error);

    res.status(500).json({
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
        name.trim(),
        description.trim(),
        instructions.trim(),
        difficulty,
        category ? category.trim() : "Other",
        image || "",
      ],
    );

    const recipeId = Number(result.lastInsertRowid);

    // -------------------------------------------------
    // Recipe ingredients
    // -------------------------------------------------

    if (Array.isArray(ingredients)) {
      for (const item of ingredients) {
        if (!item.ingredient_id || !item.quantity) {
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
            Number(item.ingredient_id),
            Number(item.quantity),
            item.unit || "",
          ],
        );
      }
    }

    res.status(201).json({
      message: "Recipe created successfully.",
      id: recipeId,
    });
  } catch (error) {
    console.error("Create recipe error:", error);

    res.status(500).json({
      error: "Failed to create recipe.",
    });
  }
});

// =====================================================
// RECIPE - UPDATE
// =====================================================

app.put("/api/recipes/:id", authenticateToken, async (req, res) => {
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

    const existing = await get(
      `
        SELECT id
        FROM recipes
        WHERE id = ?
        `,
      [req.params.id],
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
        name.trim(),
        description.trim(),
        instructions.trim(),
        difficulty,
        category ? category.trim() : "Other",
        image || "",
        req.params.id,
      ],
    );

    // Remove old ingredients

    await run(
      `
        DELETE FROM recipe_ingredients
        WHERE recipe_id = ?
        `,
      [req.params.id],
    );

    // Add new ingredients

    if (Array.isArray(ingredients)) {
      for (const item of ingredients) {
        if (!item.ingredient_id || !item.quantity) {
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
            req.params.id,
            Number(item.ingredient_id),
            Number(item.quantity),
            item.unit || "",
          ],
        );
      }
    }

    res.json({
      message: "Recipe updated successfully.",
    });
  } catch (error) {
    console.error("Update recipe error:", error);

    res.status(500).json({
      error: "Failed to update recipe.",
    });
  }
});

// =====================================================
// RECIPE - DELETE
// =====================================================

app.delete("/api/recipes/:id", authenticateToken, async (req, res) => {
  try {
    const existing = await get(
      `
        SELECT id
        FROM recipes
        WHERE id = ?
        `,
      [req.params.id],
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
      [req.params.id],
    );

    res.json({
      message: "Recipe deleted successfully.",
    });
  } catch (error) {
    console.error("Delete recipe error:", error);

    res.status(500).json({
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

    res.json({
      totalRecipes: Number(recipeCount.count) || 0,

      totalIngredients: Number(ingredientCount.count) || 0,

      easyRecipes: Number(easyCount.count) || 0,

      mediumRecipes: Number(mediumCount.count) || 0,

      hardRecipes: Number(hardCount.count) || 0,

      recentRecipes,
    });
  } catch (error) {
    console.error("Dashboard error:", error);

    res.status(500).json({
      error: "Failed to load dashboard statistics.",
    });
  }
});

// =====================================================
// FRONTEND
// =====================================================

const frontendPath = path.join(__dirname, "../frontend");

// Serve frontend files

app.use(express.static(frontendPath));

// Default page

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "login.html"));
});

// =====================================================
// API 404
// =====================================================

app.use("/api", (req, res) => {
  res.status(404).json({
    error: "API route not found.",
  });
});

// =====================================================
// GENERAL ERROR HANDLER
// =====================================================

app.use((error, req, res, next) => {
  console.error("Server error:", error);

  res.status(500).json({
    error: "Internal server error.",
  });
});

// =====================================================
// START SERVER
// =====================================================

if (require.main === module) {
  databaseReady
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Recipe Manager server running on port ${PORT}`);
      });
    })
    .catch((error) => {
      console.error("Could not start server:", error);
    });
}

// =====================================================
// EXPORT
// =====================================================

module.exports = app;
