// Login Page Logic
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const emailInput = document.getElementById("loginEmail");
  const passInput = document.getElementById("loginPassword");
  const errorMsg = document.getElementById("loginError");
  const forgotLink = document.getElementById("forgotPasswordLink");

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      const password = passInput.value.trim();

      if (!email || !password) {
        showError("Enter an email or username and any demo password to continue.");
        return;
      }

      try {
        localStorage.setItem("parul_auth_user", JSON.stringify({
          email,
          demoOnly: true,
          loggedInAt: new Date().toISOString()
        }));
      } catch (error) {
        console.error("Could not save the demo session in this browser.", error);
        showError("Browser storage is unavailable, so the demo session could not be saved.");
        return;
      }

      // Redirect to dashboard
      const targetUrl = (window.location.href.includes("/pages/") || window.location.href.includes("\\pages\\")) ? "../index.html" : "index.html";
      window.location.href = targetUrl;
    });
  }

  function showError(msg) {
    if (errorMsg) {
      errorMsg.textContent = msg;
      errorMsg.style.display = "block";
    }
  }

  if (forgotLink) {
    forgotLink.addEventListener("click", (e) => {
      e.preventDefault();
      showError("Password reset is unavailable in this frontend demo. No email was sent.");
    });
  }
});
