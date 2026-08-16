// =====================================================
// ADD / EDIT INGREDIENT
// =====================================================


// -----------------------------------------------------
// CHECK LOGIN
// -----------------------------------------------------

const token =
    localStorage.getItem("recipeManagerToken") ||
    sessionStorage.getItem("recipeManagerToken");


if (!token) {

    window.location.href =
        "login.html";

}


// -----------------------------------------------------
// API
// -----------------------------------------------------

const API_URL =
    "/api/ingredients";


// -----------------------------------------------------
// ELEMENTS
// -----------------------------------------------------

const form =
    document.getElementById(
        "ingredientForm"
    );


const nameInput =
    document.getElementById(
        "ingredientName"
    );


const unitInput =
    document.getElementById(
        "unit"
    );


const pageTitle =
    document.getElementById(
        "pageTitle"
    );


const pageDescription =
    document.getElementById(
        "pageDescription"
    );


const saveButton =
    document.getElementById(
        "saveButton"
    );


const formMessage =
    document.getElementById(
        "formMessage"
    );


// -----------------------------------------------------
// GET ID FROM URL
// -----------------------------------------------------

const urlParams =
    new URLSearchParams(
        window.location.search
    );


const ingredientId =
    urlParams.get("id");


// -----------------------------------------------------
// EDIT MODE
// -----------------------------------------------------

const editMode =
    Boolean(ingredientId);


// -----------------------------------------------------
// SHOW MESSAGE
// -----------------------------------------------------

function showMessage(
    message
) {

    formMessage.textContent =
        message;

}


// -----------------------------------------------------
// LOAD INGREDIENT
// -----------------------------------------------------

async function loadIngredient() {

    if (!editMode) {

        return;

    }


    pageTitle.textContent =
        "Edit Ingredient";


    pageDescription.textContent =
        "Update the ingredient details.";


    saveButton.textContent =
        "Update Ingredient";


    try {

        const response =
            await fetch(
                `${API_URL}/${ingredientId}`
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Failed to load ingredient."
            );

        }


        nameInput.value =
            data.name || "";


        unitInput.value =
            data.unit || "";

    } catch (error) {

        console.error(
            "Load ingredient error:",
            error
        );


        showMessage(
            error.message
        );

    }

}


// -----------------------------------------------------
// SUBMIT FORM
// -----------------------------------------------------

form.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const name =
            nameInput.value.trim();


        const unit =
            unitInput.value;


        // ---------------------------------------------
        // Validation
        // ---------------------------------------------

        if (!name) {

            showMessage(
                "Please enter an ingredient name."
            );

            nameInput.focus();

            return;

        }


        if (!unit) {

            showMessage(
                "Please select a unit of measurement."
            );

            unitInput.focus();

            return;

        }


        // ---------------------------------------------
        // Disable button
        // ---------------------------------------------

        saveButton.disabled =
            true;


        saveButton.textContent =
            editMode
                ? "Updating..."
                : "Saving...";


        try {

            const url =
                editMode
                    ? `${API_URL}/${ingredientId}`
                    : API_URL;


            const method =
                editMode
                    ? "PUT"
                    : "POST";


            const response =
                await fetch(
                    url,
                    {
                        method: method,

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

                            name: name,

                            unit: unit

                        })

                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "Failed to save ingredient."
                );

            }


            alert(
                editMode
                    ? "Ingredient updated successfully."
                    : "Ingredient added successfully."
            );


            window.location.href =
                "ingredient-list.html";


        } catch (error) {

            console.error(
                "Save ingredient error:",
                error
            );


            showMessage(
                error.message
            );


            saveButton.disabled =
                false;


            saveButton.textContent =
                editMode
                    ? "Update Ingredient"
                    : "Save Ingredient";

        }

    }
);


// -----------------------------------------------------
// LOAD EDIT DATA
// -----------------------------------------------------

loadIngredient();