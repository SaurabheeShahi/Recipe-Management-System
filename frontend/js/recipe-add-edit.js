// =====================================================
// AUTHENTICATION HELPER
// Keeps authentication consistent across all protected pages.
// =====================================================

function getAuthToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}

function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
}

async function authFetch(url, options = {}) {
  const token = getAuthToken();

  if (!token) {
    window.location.href = "login.html";
    throw new Error("Not authenticated.");
  }

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearAuth();
    window.location.href = "login.html";
    throw new Error("Your session has expired. Please login again.");
  }

  return response;
}

if (!getAuthToken()) {
  window.location.href = "login.html";
}

// =====================================================
// ADD / EDIT RECIPE
// =====================================================

// -----------------------------------------------------
// API
// -----------------------------------------------------

const API_URL = "/api/recipes";

const INGREDIENT_API = "/api/ingredients";

// -----------------------------------------------------
// ELEMENTS
// -----------------------------------------------------

const recipeForm = document.getElementById("recipeForm");

const recipeName = document.getElementById("recipeName");

const description = document.getElementById("description");

const difficulty = document.getElementById("difficulty");

const instructions = document.getElementById("instructions");

const ingredientContainer = document.getElementById("ingredientContainer");

const addIngredientButton = document.getElementById("addIngredient");

const recipeImage = document.getElementById("recipeImage");

const imagePreview = document.getElementById("imagePreview");

const saveButton = document.getElementById("saveButton");

const formMessage = document.getElementById("formMessage");

const pageTitle = document.getElementById("pageTitle");

// -----------------------------------------------------
// GET ID
// -----------------------------------------------------

const params = new URLSearchParams(window.location.search);

const recipeId = params.get("id");

const editMode = Boolean(recipeId);

// -----------------------------------------------------
// INGREDIENT DATA
// -----------------------------------------------------

let availableIngredients = [];

// -----------------------------------------------------
// LOAD INGREDIENTS
// -----------------------------------------------------

async function loadIngredients() {
  try {
    const response = await authFetch(INGREDIENT_API);

    if (!response.ok) {
      throw new Error("Failed to load ingredients.");
    }

    availableIngredients = await response.json();
  } catch (error) {
    console.error("Ingredient loading error:", error);

    formMessage.textContent = "Unable to load ingredients.";
  }
}

// -----------------------------------------------------
// CREATE INGREDIENT ROW
// -----------------------------------------------------

function createIngredientRow(selectedId = "", quantity = "") {
  const row = document.createElement("div");

  row.className = "ingredient-row";

  // ---------------------------------------------
  // Ingredient select
  // ---------------------------------------------

  const select = document.createElement("select");

  select.className = "ingredient";

  select.required = true;

  const defaultOption = document.createElement("option");

  defaultOption.value = "";

  defaultOption.textContent = "Select Ingredient";

  select.appendChild(defaultOption);

  availableIngredients.forEach((ingredient) => {
    const option = document.createElement("option");

    option.value = ingredient.id;

    option.textContent = ingredient.name;

    if (String(selectedId) === String(ingredient.id)) {
      option.selected = true;
    }

    select.appendChild(option);
  });

  // ---------------------------------------------
  // Quantity
  // ---------------------------------------------

  const quantityInput = document.createElement("input");

  quantityInput.type = "number";

  quantityInput.className = "quantity";

  quantityInput.placeholder = "Quantity";

  quantityInput.min = "0.01";

  quantityInput.step = "0.01";

  quantityInput.value = quantity;

  quantityInput.required = true;

  // ---------------------------------------------
  // Unit display
  // ---------------------------------------------

  const unitSelect = document.createElement("select");

  unitSelect.className = "unit";

  unitSelect.disabled = true;

  const units = ["g", "kg", "ml", "l", "pcs", "tbsp", "tsp"];

  units.forEach((unit) => {
    const option = document.createElement("option");

    option.value = unit;

    option.textContent = unit;

    unitSelect.appendChild(option);
  });

  // ---------------------------------------------
  // Remove button
  // ---------------------------------------------

  const removeButton = document.createElement("button");

  removeButton.type = "button";

  removeButton.className = "remove-btn";

  removeButton.textContent = "Remove";

  removeButton.addEventListener("click", function () {
    row.remove();
  });

  // ---------------------------------------------
  // Update unit automatically
  // ---------------------------------------------

  function updateUnit() {
    const selectedIngredient = availableIngredients.find(
      (ingredient) => String(ingredient.id) === String(select.value),
    );

    if (selectedIngredient) {
      unitSelect.value = selectedIngredient.unit;
    } else {
      unitSelect.value = "";
    }
  }

  select.addEventListener("change", updateUnit);

  // ---------------------------------------------
  // Build row
  // ---------------------------------------------

  row.appendChild(select);

  row.appendChild(quantityInput);

  row.appendChild(unitSelect);

  row.appendChild(removeButton);

  ingredientContainer.appendChild(row);

  updateUnit();
}

// -----------------------------------------------------
// ADD INGREDIENT BUTTON
// -----------------------------------------------------

addIngredientButton.addEventListener("click", function () {
  createIngredientRow();
});

// -----------------------------------------------------
// IMAGE PREVIEW
// -----------------------------------------------------

recipeImage.addEventListener("change", function () {
  const file = this.files[0];

  if (!file) {
    imagePreview.innerHTML = "";

    return;
  }

  if (!file.type.startsWith("image/")) {
    alert("Please select a valid image file.");

    this.value = "";

    return;
  }

  const reader = new FileReader();

  reader.onload = function (event) {
    imagePreview.innerHTML = `
                    <img
                        src="${event.target.result}"
                        alt="Recipe preview"
                        style="max-width:300px;"
                    >
                `;
  };

  reader.readAsDataURL(file);
});

// -----------------------------------------------------
// LOAD RECIPE FOR EDITING
// -----------------------------------------------------

async function loadRecipe() {
  if (!editMode) {
    // New recipe gets one row

    if (availableIngredients.length > 0) {
      createIngredientRow();
    }

    return;
  }

  pageTitle.textContent = "Edit Recipe";

  saveButton.textContent = "Update Recipe";

  try {
    const response = await authFetch(`${API_URL}/${recipeId}`);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to load recipe.");
    }

    // -----------------------------------------
    // Basic information
    // -----------------------------------------

    recipeName.value = data.name || "";

    description.value = data.description || "";

    difficulty.value = data.difficulty || "";

    instructions.value = data.instructions || "";

    // -----------------------------------------
    // Ingredients
    // -----------------------------------------

    ingredientContainer.innerHTML = "";

    if (data.ingredients && data.ingredients.length > 0) {
      data.ingredients.forEach((ingredient) => {
        createIngredientRow(
          ingredient.ingredient_id || ingredient.id,
          ingredient.quantity,
        );
      });
    } else {
      createIngredientRow();
    }

    // -----------------------------------------
    // Existing image
    // -----------------------------------------

    if (data.image) {
      imagePreview.innerHTML = `
                <img
                    src="/uploads/${encodeURIComponent(data.image)}"
                    alt="${data.name}"
                    style="max-width:300px;"
                >
            `;
    }
  } catch (error) {
    console.error("Load recipe error:", error);

    formMessage.textContent = error.message;
  }
}

// -----------------------------------------------------
// SUBMIT RECIPE
// -----------------------------------------------------

recipeForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  formMessage.textContent = "";

  // ---------------------------------------------
  // Basic validation
  // ---------------------------------------------

  if (!recipeName.value.trim()) {
    formMessage.textContent = "Please enter a recipe name.";

    return;
  }

  if (!description.value.trim()) {
    formMessage.textContent = "Please enter a description.";

    return;
  }

  if (!difficulty.value) {
    formMessage.textContent = "Please select a difficulty.";

    return;
  }

  if (!instructions.value.trim()) {
    formMessage.textContent = "Please enter instructions.";

    return;
  }

  const rows = document.querySelectorAll(".ingredient-row");

  if (rows.length === 0) {
    formMessage.textContent = "Please add at least one ingredient.";

    return;
  }

  // ---------------------------------------------
  // Collect ingredients
  // ---------------------------------------------

  const selectedIngredients = [];

  let invalidIngredient = false;

  rows.forEach((row) => {
    const ingredientSelect = row.querySelector(".ingredient");

    const quantityInput = row.querySelector(".quantity");

    const unitSelect = row.querySelector(".unit");

    if (!ingredientSelect.value || !quantityInput.value) {
      invalidIngredient = true;

      return;
    }

    selectedIngredients.push({
      ingredient_id: Number(ingredientSelect.value),

      quantity: Number(quantityInput.value),

      unit: unitSelect.value,
    });
  });

  if (invalidIngredient) {
    formMessage.textContent =
      "Please select an ingredient and enter its quantity.";

    return;
  }

  // ---------------------------------------------
  // Image validation
  // ---------------------------------------------

  const imageFile = recipeImage.files[0];

  if (!editMode && !imageFile) {
    formMessage.textContent = "Please upload a recipe image.";

    return;
  }

  if (imageFile && !imageFile.type.startsWith("image/")) {
    formMessage.textContent = "Please select a valid image file.";

    return;
  }

  // ---------------------------------------------
  // FormData
  // ---------------------------------------------

  const formData = new FormData();

  formData.append("name", recipeName.value.trim());

  formData.append("description", description.value.trim());

  formData.append("difficulty", difficulty.value);

  formData.append("instructions", instructions.value.trim());

  formData.append("ingredients", JSON.stringify(selectedIngredients));

  if (imageFile) {
    formData.append("image", imageFile);
  }

  // ---------------------------------------------
  // Save
  // ---------------------------------------------

  saveButton.disabled = true;

  saveButton.textContent = editMode ? "Updating..." : "Saving...";

  try {
    const url = editMode ? `${API_URL}/${recipeId}` : API_URL;

    const method = editMode ? "PUT" : "POST";

    const response = await authFetch(url, {
      method: method,

      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to save recipe.");
    }

    alert(
      editMode ? "Recipe updated successfully." : "Recipe added successfully.",
    );

    window.location.href = "recipe-list.html";
  } catch (error) {
    console.error("Save recipe error:", error);

    formMessage.textContent = error.message;

    saveButton.disabled = false;

    saveButton.textContent = editMode ? "Update Recipe" : "Save Recipe";
  }
});

// -----------------------------------------------------
// INITIALIZE
// -----------------------------------------------------

async function initialize() {
  await loadIngredients();

  await loadRecipe();
}

initialize();
