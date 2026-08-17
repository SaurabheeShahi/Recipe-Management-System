// =====================================================
// AUTHENTICATION HELPER
// Keeps authentication consistent across all protected pages.
// =====================================================

function getAuthToken() {
    return localStorage.getItem("token") ||
           sessionStorage.getItem("token");
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
        headers
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
// VIEW RECIPE
// =====================================================


// -----------------------------------------------------
// API
// -----------------------------------------------------

const API_URL =
    "/api/recipes";


// -----------------------------------------------------
// GET RECIPE ID
// -----------------------------------------------------

const params =
    new URLSearchParams(
        window.location.search
    );


const recipeId =
    params.get("id");


if (!recipeId) {

    alert(
        "Recipe ID was not provided."
    );


    window.location.href =
        "recipe-list.html";

}


// -----------------------------------------------------
// ELEMENTS
// -----------------------------------------------------

const recipeImage =
    document.getElementById(
        "recipeImage"
    );


const recipeCategory =
    document.getElementById(
        "recipeCategory"
    );


const recipeName =
    document.getElementById(
        "recipeName"
    );


const recipeDifficulty =
    document.getElementById(
        "recipeDifficulty"
    );


const recipeDescription =
    document.getElementById(
        "recipeDescription"
    );


const ingredientList =
    document.getElementById(
        "ingredientList"
    );


const instructionList =
    document.getElementById(
        "instructionList"
    );


const editBtn =
    document.getElementById(
        "editBtn"
    );


const deleteBtn =
    document.getElementById(
        "deleteBtn"
    );


// -----------------------------------------------------
// LOAD RECIPE
// -----------------------------------------------------

async function loadRecipe() {

    try {

        const response =
            await authFetch(
                `${API_URL}/${recipeId}`
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Recipe not found."
            );

        }


        displayRecipe(
            data
        );


    } catch (error) {

        console.error(
            "Recipe loading error:",
            error
        );


        alert(
            error.message
        );


        window.location.href =
            "recipe-list.html";

    }

}


// -----------------------------------------------------
// DISPLAY RECIPE
// -----------------------------------------------------

function displayRecipe(
    recipe
) {

    // ---------------------------------------------
    // Image
    // ---------------------------------------------

    if (recipe.image) {

        recipeImage.src =
            `/uploads/${encodeURIComponent(
                recipe.image
            )}`;

    }


    recipeImage.alt =
        recipe.name;


    recipeImage.onerror =
        function () {

            this.src =
                "images/chicken-curry.jpg";

        };


    // ---------------------------------------------
    // Basic information
    // ---------------------------------------------

    recipeCategory.textContent =
        recipe.category ||
        "Recipe";


    recipeName.textContent =
        recipe.name;


    recipeDifficulty.textContent =
        `Difficulty: ${
            recipe.difficulty ||
            "Not specified"
        }`;


    recipeDescription.textContent =
        recipe.description ||
        "No description available.";


    // ---------------------------------------------
    // Ingredients
    // ---------------------------------------------

    ingredientList.innerHTML = "";


    if (
        !recipe.ingredients ||
        recipe.ingredients.length === 0
    ) {

        ingredientList.innerHTML = `
            <li>
                No ingredients listed.
            </li>
        `;

    } else {

        recipe.ingredients.forEach(
            ingredient => {

                const li =
                    document.createElement(
                        "li"
                    );


                li.textContent =
                    `${ingredient.quantity} ${
                        ingredient.unit || ""
                    } ${
                        ingredient.name
                    }`;


                ingredientList.appendChild(
                    li
                );

            }
        );

    }


    // ---------------------------------------------
    // Instructions
    // ---------------------------------------------

    instructionList.innerHTML = "";


    const instructions =
        String(
            recipe.instructions || ""
        )
        .split(/\r?\n/)
        .map(
            instruction =>
                instruction.trim()
        )
        .filter(
            instruction =>
                instruction.length > 0
        );


    if (instructions.length === 0) {

        instructionList.innerHTML = `
            <li>
                No instructions available.
            </li>
        `;

    } else {

        instructions.forEach(
            instruction => {

                const li =
                    document.createElement(
                        "li"
                    );


                li.textContent =
                    instruction;


                instructionList.appendChild(
                    li
                );

            }
        );

    }


    // ---------------------------------------------
    // Edit link
    // ---------------------------------------------

    editBtn.href =
        `recipe-add-edit.html?id=${recipe.id}`;

}


// -----------------------------------------------------
// DELETE RECIPE
// -----------------------------------------------------

deleteBtn.addEventListener(
    "click",
    async function () {

        const confirmed =
            confirm(
                "Are you sure you want to delete this recipe?"
            );


        if (!confirmed) {

            return;

        }


        deleteBtn.disabled =
            true;


        deleteBtn.textContent =
            "Deleting...";


        try {

            const response =
                await authFetch(
                    `${API_URL}/${recipeId}`,
                    {
                        method: "DELETE"
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "Failed to delete recipe."
                );

            }


            alert(
                "Recipe deleted successfully."
            );


            window.location.href =
                "recipe-list.html";


        } catch (error) {

            console.error(
                "Delete error:",
                error
            );


            alert(
                error.message
            );


            deleteBtn.disabled =
                false;


            deleteBtn.textContent =
                "Delete Recipe";

        }

    }
);


// -----------------------------------------------------
// LOAD
// -----------------------------------------------------

loadRecipe();