require("dotenv").config();

const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const { run, get, all, databaseReady } = require("./db");

const app = express();

// =====================================================
// CONFIGURATION
// =====================================================

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn("WARNING: JWT_SECRET is not set.");
}

// =====================================================
// MULTER - IMAGE UPLOAD
// =====================================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 2 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed."));
    }

    cb(null, true);
  },
});

// =====================================================
// BODY PARSERS
// =====================================================

app.use(
  express.json({
    limit: "5mb",
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "5mb",
  }),
);

// =====================================================
// DATABASE READY
// =====================================================

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
// HELPER - ID
// =====================================================

function getId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

// =====================================================
// HELPER - TOKEN
// =====================================================

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.trim().split(/\s+/);

  if (parts.length !== 2) {
    return null;
  }

  if (parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}

// =====================================================
// AUTHENTICATION
// =====================================================

function authenticateToken(req, res, next) {
  if (!JWT_SECRET) {
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
// API HEALTH
// =====================================================

app.get("/api", (req, res) => {
  res.json({
    message: "Recipe Management System API is running.",
    database: "connected",
  });
});

// =====================================================
// SIGNUP
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

    const cleanEmail = String(email).trim().toLowerCase();

    const cleanPassword = String(password);

    if (cleanName.length < 2) {
      return res.status(400).json({
        error: "Name must be at least 2 characters.",
      });
    }

    if (!cleanEmail.includes("@")) {
      return res.status(400).json({
        error: "Please enter a valid email address.",
      });
    }

    if (cleanPassword.length < 6) {
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
      [cleanEmail],
    );

    if (existingUser) {
      return res.status(409).json({
        error: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(cleanPassword, 10);

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
      [cleanName, cleanEmail, passwordHash, "admin"],
    );

    return res.status(201).json({
      message: "Account created successfully.",

      user: {
        id: Number(result.lastInsertRowid),
        name: cleanName,
        email: cleanEmail,
        role: "admin",
      },
    });
  } catch (error) {
    console.error("Signup error:", error);

    return res.status(500).json({
      error: "Server error while creating account.",
    });
  }
});

// =====================================================
// LOGIN
// =====================================================

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Please enter your email and password.",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const cleanPassword = String(password);

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
      [cleanEmail],
    );

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    const passwordCorrect = await bcrypt.compare(
      cleanPassword,
      user.password_hash,
    );

    if (!passwordCorrect) {
      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    if (!JWT_SECRET) {
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
// CURRENT USER
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

    return res.json(
      ingredients.map((item) => ({
        ...item,
        id: Number(item.id),
      })),
    );
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
      ...ingredient,
      id: Number(ingredient.id),
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
// PARSE INGREDIENTS
// =====================================================

function parseIngredients(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Ingredient JSON error:", error);

      throw new Error("Invalid ingredient data.");
    }
  }

  return [];
}

// =====================================================
// ADD RECIPE INGREDIENTS
// =====================================================

async function addRecipeIngredients(recipeId, ingredients) {
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    throw new Error("At least one ingredient is required.");
  }

  for (const item of ingredients) {
    const ingredientId = Number(item.ingredient_id);

    const quantity = Number(item.quantity);

    if (!Number.isInteger(ingredientId) || ingredientId <= 0) {
      throw new Error("Invalid ingredient selected.");
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("Invalid ingredient quantity.");
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
      [ingredientId],
    );

    if (!ingredient) {
      throw new Error(
        `Ingredient with ID ${ingredientId} was not found in the database.`,
      );
    }

    const unit = item.unit
      ? String(item.unit).trim()
      : String(ingredient.unit).trim();

    if (!unit) {
      throw new Error(`Unit is missing for ingredient "${ingredient.name}".`);
    }

    console.log("Adding recipe ingredient:", {
      recipeId,
      ingredientId,
      quantity,
      unit,
    });

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
      [recipeId, ingredientId, quantity, unit],
    );
  }
}

// =====================================================
// RECIPE - CREATE
// =====================================================

app.post(
  "/api/recipes",
  authenticateToken,
  upload.single("image"),
  async (req, res) => {
    let recipeId = null;

    try {
      console.log("=================================");

      console.log("CREATE RECIPE REQUEST");

      console.log("Body:", req.body);

      console.log(
        "Image:",
        req.file
          ? `${req.file.originalname} (${req.file.size} bytes)`
          : "No image",
      );

      console.log("=================================");

      const {
        name,
        description,
        instructions,
        difficulty,
        category,
        ingredients,
      } = req.body;

      // -------------------------------------------------
      // VALIDATION
      // -------------------------------------------------

      if (!name || !String(name).trim()) {
        return res.status(400).json({
          error: "Recipe name is required.",
        });
      }

      if (!description || !String(description).trim()) {
        return res.status(400).json({
          error: "Recipe description is required.",
        });
      }

      if (!instructions || !String(instructions).trim()) {
        return res.status(400).json({
          error: "Recipe instructions are required.",
        });
      }

      if (!difficulty) {
        return res.status(400).json({
          error: "Recipe difficulty is required.",
        });
      }

      const validDifficulties = ["Easy", "Medium", "Hard"];

      if (!validDifficulties.includes(String(difficulty))) {
        return res.status(400).json({
          error: "Invalid difficulty level.",
        });
      }

      // -------------------------------------------------
      // IMAGE
      // -------------------------------------------------

      let image = "";

      if (req.file) {
        image =
          `data:${req.file.mimetype};base64,` +
          req.file.buffer.toString("base64");
      }

      // -------------------------------------------------
      // INGREDIENTS
      // -------------------------------------------------

      const recipeIngredients = parseIngredients(ingredients);

      if (recipeIngredients.length === 0) {
        return res.status(400).json({
          error: "Please add at least one ingredient.",
        });
      }

      // -------------------------------------------------
      // INSERT RECIPE
      // -------------------------------------------------

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
          String(name).trim(),
          String(description).trim(),
          String(instructions).trim(),
          String(difficulty),
          category && String(category).trim()
            ? String(category).trim()
            : "Other",
          image,
        ],
      );

      recipeId = Number(result.lastInsertRowid);

      if (!recipeId) {
        throw new Error("Recipe was created but no recipe ID was returned.");
      }

      // -------------------------------------------------
      // INSERT INGREDIENTS
      // -------------------------------------------------

      await addRecipeIngredients(recipeId, recipeIngredients);

      console.log(`Recipe ${recipeId} created successfully.`);

      return res.status(201).json({
        success: true,
        message: "Recipe created successfully.",
        id: recipeId,
      });
    } catch (error) {
      console.error("=================================");

      console.error("CREATE RECIPE ERROR");

      console.error(error);

      console.error("=================================");

      // -------------------------------------------------
      // CLEAN UP PARTIALLY CREATED RECIPE
      // -------------------------------------------------

      if (recipeId) {
        try {
          await run(
            `
            DELETE FROM recipes
            WHERE id = ?
            `,
            [recipeId],
          );

          console.log(`Rolled back recipe ${recipeId}.`);
        } catch (cleanupError) {
          console.error("Cleanup error:", cleanupError);
        }
      }

      return res.status(500).json({
        success: false,
        error: error.message || "Failed to create recipe.",
      });
    }
  },
);

// =====================================================
// RECIPE - UPDATE
// =====================================================

app.put(
  "/api/recipes/:id",
  authenticateToken,
  upload.single("image"),
  async (req, res) => {
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
        ingredients,
      } = req.body;

      if (!name || !String(name).trim()) {
        return res.status(400).json({
          error: "Recipe name is required.",
        });
      }

      if (!description || !String(description).trim()) {
        return res.status(400).json({
          error: "Recipe description is required.",
        });
      }

      if (!instructions || !String(instructions).trim()) {
        return res.status(400).json({
          error: "Recipe instructions are required.",
        });
      }

      if (!difficulty) {
        return res.status(400).json({
          error: "Recipe difficulty is required.",
        });
      }

      const validDifficulties = ["Easy", "Medium", "Hard"];

      if (!validDifficulties.includes(String(difficulty))) {
        return res.status(400).json({
          error: "Invalid difficulty level.",
        });
      }

      const existingRecipe = await get(
        `
          SELECT
            id,
            image
          FROM recipes
          WHERE id = ?
          `,
        [id],
      );

      if (!existingRecipe) {
        return res.status(404).json({
          error: "Recipe not found.",
        });
      }

      // -------------------------------------------------
      // IMAGE
      // -------------------------------------------------

      let image = existingRecipe.image || "";

      if (req.file) {
        image =
          `data:${req.file.mimetype};base64,` +
          req.file.buffer.toString("base64");
      }

      // -------------------------------------------------
      // INGREDIENTS
      // -------------------------------------------------

      const recipeIngredients = parseIngredients(ingredients);

      if (recipeIngredients.length === 0) {
        return res.status(400).json({
          error: "Please add at least one ingredient.",
        });
      }

      // -------------------------------------------------
      // UPDATE RECIPE
      // -------------------------------------------------

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
          String(difficulty),
          category && String(category).trim()
            ? String(category).trim()
            : "Other",
          image,
          id,
        ],
      );

      // -------------------------------------------------
      // DELETE OLD INGREDIENTS
      // -------------------------------------------------

      await run(
        `
        DELETE FROM recipe_ingredients
        WHERE recipe_id = ?
        `,
        [id],
      );

      // -------------------------------------------------
      // ADD NEW INGREDIENTS
      // -------------------------------------------------

      await addRecipeIngredients(id, recipeIngredients);

      return res.json({
        success: true,
        message: "Recipe updated successfully.",
      });
    } catch (error) {
      console.error("UPDATE RECIPE ERROR:", error);

      return res.status(500).json({
        success: false,
        error: error.message || "Failed to update recipe.",
      });
    }
  },
);

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
      totalRecipes: Number(recipeCount.count) || 0,

      totalIngredients: Number(ingredientCount.count) || 0,

      easyRecipes: Number(easyCount.count) || 0,

      mediumRecipes: Number(mediumCount.count) || 0,

      hardRecipes: Number(hardCount.count) || 0,

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
// ERROR HANDLER
// =====================================================

app.use((error, req, res, next) => {
  console.error("Server error:", error);

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "Image is too large. Maximum size is 2 MB.",
      });
    }

    return res.status(400).json({
      error: error.message,
    });
  }

  if (error.message === "Only image files are allowed.") {
    return res.status(400).json({
      error: error.message,
    });
  }

  return res.status(500).json({
    error: error.message || "Internal server error.",
  });
});

// =====================================================
// START LOCAL SERVER
// =====================================================

if (require.main === module) {
  databaseReady
    .then(() => {
      app.listen(PORT, () => {
        console.log("=================================");

        console.log(`Recipe Manager server running on port ${PORT}`);

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
// VERCEL
// =====================================================

module.exports = app;
