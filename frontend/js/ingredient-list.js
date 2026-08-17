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
// INGREDIENT LIST
// =====================================================


// -----------------------------------------------------
// API
// -----------------------------------------------------

const API_URL =
    "/api/ingredients";


// -----------------------------------------------------
// VARIABLES
// -----------------------------------------------------

let ingredients = [];


// -----------------------------------------------------
// LOAD INGREDIENTS
// -----------------------------------------------------

async function loadIngredients() {

    const table =
        document.getElementById(
            "ingredientTable"
        );


    table.innerHTML = `
        <tr>
            <td colspan="4">
                Loading ingredients...
            </td>
        </tr>
    `;


    try {

        const response =
            await authFetch(API_URL);


        if (!response.ok) {

            throw new Error(
                "Failed to load ingredients."
            );

        }


        ingredients =
            await response.json();


        displayIngredients(
            ingredients
        );

    } catch (error) {

        console.error(
            "Ingredient loading error:",
            error
        );


        table.innerHTML = `
            <tr>
                <td colspan="4">
                    Failed to load ingredients.
                </td>
            </tr>
        `;

    }

}


// -----------------------------------------------------
// DISPLAY INGREDIENTS
// -----------------------------------------------------

function displayIngredients(
    ingredientData
) {

    const table =
        document.getElementById(
            "ingredientTable"
        );


    table.innerHTML = "";


    if (
        !ingredientData ||
        ingredientData.length === 0
    ) {

        table.innerHTML = `
            <tr>
                <td colspan="4">
                    No ingredients found.
                </td>
            </tr>
        `;

        return;

    }


    ingredientData.forEach(
        (ingredient, index) => {

            const row =
                document.createElement("tr");


            // -----------------------------------------
            // Number
            // -----------------------------------------

            const numberCell =
                document.createElement("td");

            numberCell.textContent =
                index + 1;


            // -----------------------------------------
            // Name
            // -----------------------------------------

            const nameCell =
                document.createElement("td");

            nameCell.textContent =
                ingredient.name;


            // -----------------------------------------
            // Unit
            // -----------------------------------------

            const unitCell =
                document.createElement("td");

            unitCell.textContent =
                ingredient.unit;


            // -----------------------------------------
            // Actions
            // -----------------------------------------

            const actionCell =
                document.createElement("td");


            const editLink =
                document.createElement("a");

            editLink.href =
                `ingredient-add-edit.html?id=${ingredient.id}`;

            editLink.className =
                "edit";

            editLink.textContent =
                "Edit";


            const deleteButton =
                document.createElement("button");

            deleteButton.type =
                "button";

            deleteButton.className =
                "delete";

            deleteButton.textContent =
                "Delete";


            deleteButton.addEventListener(
                "click",
                function () {

                    deleteIngredient(
                        ingredient.id
                    );

                }
            );


            actionCell.appendChild(
                editLink
            );

            actionCell.appendChild(
                deleteButton
            );


            // -----------------------------------------
            // Add cells
            // -----------------------------------------

            row.appendChild(
                numberCell
            );

            row.appendChild(
                nameCell
            );

            row.appendChild(
                unitCell
            );

            row.appendChild(
                actionCell
            );


            table.appendChild(
                row
            );

        }
    );

}


// -----------------------------------------------------
// DELETE INGREDIENT
// -----------------------------------------------------

async function deleteIngredient(
    ingredientId
) {

    const confirmed =
        confirm(
            "Are you sure you want to delete this ingredient?"
        );


    if (!confirmed) {

        return;

    }


    try {

        const response =
            await authFetch(
                `${API_URL}/${ingredientId}`,
                {
                    method: "DELETE"
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.error ||
                "Failed to delete ingredient."
            );

            return;

        }


        alert(
            "Ingredient deleted successfully."
        );


        loadIngredients();

    } catch (error) {

        console.error(
            "Delete error:",
            error
        );


        alert(
            "Unable to connect to the server."
        );

    }

}


// -----------------------------------------------------
// SEARCH
// -----------------------------------------------------

document
    .getElementById("ingredientSearch")
    .addEventListener(
        "input",
        function () {

            const searchValue =
                this.value
                    .trim()
                    .toLowerCase();


            const filtered =
                ingredients.filter(
                    ingredient =>
                        ingredient.name
                            .toLowerCase()
                            .includes(searchValue)
                );


            displayIngredients(
                filtered
            );

        }
    );


// -----------------------------------------------------
// LOAD
// -----------------------------------------------------

loadIngredients();