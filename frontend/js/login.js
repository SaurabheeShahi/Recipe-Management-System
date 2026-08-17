document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const remember = document.getElementById("remember").checked;
  const message = document.getElementById("loginMessage");
  const button = document.getElementById("loginButton");

  button.disabled = true;
  message.textContent = "Logging in...";

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      message.textContent = data.error || "Login failed.";
      button.disabled = false;
      return;
    }

    // Remove any old login state first.
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");

    if (remember) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
    } else {
      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("user", JSON.stringify(data.user));
    }

    window.location.href = "dashboard.html";
  } catch (error) {
    console.error("Login error:", error);
    message.textContent = "Unable to connect to server.";
    button.disabled = false;
  }
});
