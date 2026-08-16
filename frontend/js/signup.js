// =====================================================
// SIGNUP
// =====================================================

const signupForm = document.getElementById("signupForm");

const passwordInput = document.getElementById("password");

const confirmPasswordInput = document.getElementById("confirmPassword");

const passwordMessage = document.getElementById("passwordMessage");

// =====================================================
// PASSWORD VALIDATION
// =====================================================

passwordInput.addEventListener("input", () => {
  if (passwordInput.value.length < 8) {
    passwordMessage.textContent = "Password must be at least 8 characters.";

    passwordMessage.style.color = "red";
  } else {
    passwordMessage.textContent = "Password strength is acceptable.";

    passwordMessage.style.color = "green";
  }
});

// =====================================================
// SIGNUP SUBMIT
// =====================================================

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("name").value.trim();

  const email = document.getElementById("email").value.trim();

  const password = passwordInput.value;

  const confirmPassword = confirmPasswordInput.value;

  const terms = document.getElementById("terms").checked;

  // -------------------------------------------------
  // Validation
  // -------------------------------------------------

  if (!name || !email || !password || !confirmPassword) {
    alert("Please fill in all fields.");
    return;
  }

  if (name.length < 2) {
    alert("Name must be at least 2 characters.");
    return;
  }

  if (password.length < 8) {
    alert("Password must be at least 8 characters.");
    return;
  }

  if (password !== confirmPassword) {
    alert("Passwords do not match.");
    return;
  }

  if (!terms) {
    alert("Please agree to the terms and conditions.");
    return;
  }

  // -------------------------------------------------
  // Disable button
  // -------------------------------------------------

  const signupButton = signupForm.querySelector(".signup-btn");

  signupButton.disabled = true;

  signupButton.textContent = "Creating Account...";

  try {
    // -------------------------------------------------
    // Send request
    // -------------------------------------------------

    const response = await fetch("/api/auth/signup", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        name: name,
        email: email,
        password: password,
      }),
    });

    const data = await response.json();

    // -------------------------------------------------
    // Error
    // -------------------------------------------------

    if (!response.ok) {
      alert(data.error || "Failed to create account.");

      return;
    }

    // -------------------------------------------------
    // Success
    // -------------------------------------------------

    alert("Account created successfully! Please login.");

    window.location.href = "login.html";
  } catch (error) {
    console.error("Signup error:", error);

    alert("Unable to connect to the server.");
  } finally {
    signupButton.disabled = false;

    signupButton.textContent = "Create Account";
  }
});
