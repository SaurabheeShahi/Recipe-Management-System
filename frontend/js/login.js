document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("token");

    // Check whether user is logged in
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    try {
        const response = await fetch("/api/dashboard", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        // If token is invalid, go back to login
        if (response.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");

            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error("Failed to load dashboard.");
        }

        const data = await response.json();

        // -----------------------------------------
        // Update statistics
        // -----------------------------------------

        const statCards = document.querySelectorAll(".stat-card h2");

        if (statCards.length >= 4) {
            statCards[0].textContent = data.totalRecipes || 0;
            statCards[1].textContent = data.totalIngredients || 0;
            statCards[2].textContent = data.easyRecipes || 0;
            statCards[3].textContent = data.hardRecipes || 0;
        }

        // -----------------------------------------
        // Recent recipes
        // -----------------------------------------

        const recentContainer =
            document.querySelector(".recent-recipes");

        if (!recentContainer) {
            return;
        }

        recentContainer.innerHTML = "";

        if (
            !data.recentRecipes ||
            data.recentRecipes.length === 0
        ) {
            recentContainer.innerHTML = `
                <p>No recipes have been added yet.</p>
            `;

            return;
        }

        data.recentRecipes.forEach((recipe) => {
            const card = document.createElement("div");

            card.className = "recent-card";

            const image =
                recipe.image ||
                "images/default-recipe.jpg";

            card.innerHTML = `
                <img
                    src="${image}"
                    alt="${recipe.name}"
                    onerror="this.src='images/default-recipe.jpg'"
                >

                <div class="recent-info">

                    <span>
                        ${recipe.category || "Other"}
                    </span>

                    <h3>
                        ${recipe.name}
                    </h3>

                    <p>
                        ${recipe.difficulty} Difficulty
                    </p>

                </div>
            `;

            recentContainer.appendChild(card);
        });

    } catch (error) {
        console.error(
            "Dashboard error:",
            error
        );

        // Do NOT immediately redirect to login
        // for a normal server/network error.

        alert(
            "Unable to load dashboard data. Please try again."
        );
    }
});