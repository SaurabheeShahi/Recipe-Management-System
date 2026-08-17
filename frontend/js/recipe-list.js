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
// RECIPE LIST
// =====================================================


// -----------------------------------------------------
// API
// -----------------------------------------------------

const API_URL =
    "/api/recipes";


// -----------------------------------------------------
// VARIABLES
// -----------------------------------------------------

let recipes = [];


// -----------------------------------------------------
// LOAD RECIPES
// -----------------------------------------------------

async function loadRecipes() {

    const grid =
        document.getElementById(
            "recipeGrid"
        );


    grid.innerHTML =
        "<p>Loading recipes...</p>";


    try {

        const response =
            await authFetch(API_URL);


        if (!response.ok) {

            throw new Error(
                "Failed to load recipes."
            );

        }


        recipes =
            await response.json();


        displayRecipes(
            recipes
        );


    } catch (error) {

        console.error(
            "Recipe loading error:",
            error
        );


        grid.innerHTML = `
            <p>
                Failed to load recipes.
            </p>
        `;

    }

}


// -----------------------------------------------------
// DISPLAY RECIPES
// -----------------------------------------------------

function displayRecipes(
    recipeData
) {

    const grid =
        document.getElementById(
            "recipeGrid"
        );


    grid.innerHTML = "";


    if (
        !recipeData ||
        recipeData.length === 0
    ) {

        grid.innerHTML = `
            <p>
                No recipes found.
            </p>
        `;

        return;

    }


    recipeData.forEach(
        recipe => {

            const card =
                document.createElement("div");


            card.className =
                "recipe-card";


            // -----------------------------------------
            // Image
            // -----------------------------------------

            const image =
                document.createElement("img");


            if (recipe.image) {

                image.src =
                    `/uploads/${encodeURIComponent(
                        recipe.image
                    )}`;

            } else {

                image.src =
                    "images/chicken-curry.jpg";

            }


            image.alt =
                recipe.name;


            image.onerror =
                function () {

                    this.src =
                        "images/chicken-curry.jpg";

                };


            // -----------------------------------------
            // Content
            // -----------------------------------------

            const content =
                document.createElement("div");


            content.className =
                "recipe-content";


            const category =
                document.createElement("span");


            category.className =
                "category";


            category.textContent =
                recipe.category ||
                "Recipe";


            const title =
                document.createElement("h2");


            title.textContent =
                recipe.name;


            const difficulty =
                document.createElement("p");


            difficulty.textContent =
                `Difficulty: ${
                    recipe.difficulty ||
                    "Not specified"
                }`;


            // -----------------------------------------
            // View button
            // -----------------------------------------

            const viewButton =
                document.createElement("a");


            viewButton.href =
                `recipe-view.html?id=${recipe.id}`;


            viewButton.className =
                "view-btn";


            viewButton.textContent =
                "View Recipe";


            // -----------------------------------------
            // Build card
            // -----------------------------------------

            content.appendChild(
                category
            );

            content.appendChild(
                title
            );

            content.appendChild(
                difficulty
            );

            content.appendChild(
                viewButton
            );


            card.appendChild(
                image
            );

            card.appendChild(
                content
            );


            grid.appendChild(
                card
            );

        }
    );

}


// -----------------------------------------------------
// FILTER RECIPES
// -----------------------------------------------------

function filterRecipes() {

    const searchValue =
        document
            .getElementById("searchInput")
            .value
            .trim()
            .toLowerCase();


    const difficulty =
        document
            .getElementById("difficultyFilter")
            .value
            .toLowerCase();


    const filtered =
        recipes.filter(
            recipe => {

                const name =
                    String(
                        recipe.name || ""
                    ).toLowerCase();


                const recipeDifficulty =
                    String(
                        recipe.difficulty || ""
                    ).toLowerCase();


                const matchesName =
                    name.includes(
                        searchValue
                    );


                const matchesDifficulty =
                    !difficulty ||
                    recipeDifficulty ===
                    difficulty;


                return (
                    matchesName &&
                    matchesDifficulty
                );

            }
        );


    displayRecipes(
        filtered
    );

}


// -----------------------------------------------------
// SEARCH
// -----------------------------------------------------

document
    .getElementById("searchInput")
    .addEventListener(
        "input",
        filterRecipes
    );


// -----------------------------------------------------
// DIFFICULTY
// -----------------------------------------------------

document
    .getElementById("difficultyFilter")
    .addEventListener(
        "change",
        filterRecipes
    );


// -----------------------------------------------------
// LOAD
// -----------------------------------------------------

loadRecipes();