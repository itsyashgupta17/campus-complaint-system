// Login and User Authentication Logic
document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const tabSignIn = document.getElementById("tabSignIn");
  const tabRegister = document.getElementById("tabRegister");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const loginEmail = document.getElementById("loginEmail");
  const loginPassword = document.getElementById("loginPassword");
  const signInSubmitBtn = document.getElementById("signInSubmitBtn");
  const regName = document.getElementById("regName");
  const regEmail = document.getElementById("regEmail");
  const regRole = document.getElementById("regRole");
  const regPassword = document.getElementById("regPassword");
  const registerSubmitBtn = document.getElementById("registerSubmitBtn");
  const errorMsg = document.getElementById("loginError");
  const successMsg = document.getElementById("loginSuccess");
  const btnQuickFill = document.getElementById("btnQuickFill");
  const toggleLoginPassword = document.getElementById("toggleLoginPassword");
  const toggleRegPassword = document.getElementById("toggleRegPassword");
  const forgotLink = document.getElementById("forgotPasswordLink");

  // 1. Password Visibility Toggles
  if (toggleLoginPassword && loginPassword) {
    toggleLoginPassword.addEventListener("click", () => {
      const isPassword = loginPassword.type === "password";
      loginPassword.type = isPassword ? "text" : "password";
      toggleLoginPassword.textContent = isPassword ? "🙈" : "👁️";
    });
  }

  if (toggleRegPassword && regPassword) {
    toggleRegPassword.addEventListener("click", () => {
      const isPassword = regPassword.type === "password";
      regPassword.type = isPassword ? "text" : "password";
      toggleRegPassword.textContent = isPassword ? "🙈" : "👁️";
    });
  }

  // 2. Tab Switching
  if (tabSignIn && tabRegister) {
    tabSignIn.addEventListener("click", () => {
      tabSignIn.classList.add("active");
      tabRegister.classList.remove("active");
      loginForm.style.display = "block";
      registerForm.style.display = "none";
      hideMessages();
    });

    tabRegister.addEventListener("click", () => {
      tabRegister.classList.add("active");
      tabSignIn.classList.remove("active");
      registerForm.style.display = "block";
      loginForm.style.display = "none";
      hideMessages();
    });
  }

  // 3. Quick-Fill Demo Credentials Button
  if (btnQuickFill) {
    btnQuickFill.addEventListener("click", () => {
      if (tabSignIn) tabSignIn.click();
      if (loginEmail) loginEmail.value = "divya@paruluniversity.ac.in";
      if (loginPassword) loginPassword.value = "Admin@123";
      showSuccess("Credentials filled! Click 'Sign In to Dashboard' to proceed.");
    });
  }

  // 4. Forgot Password notice
  if (forgotLink) {
    forgotLink.addEventListener("click", (e) => {
      e.preventDefault();
      showError("Please contact the Parul University Campus IT Helpdesk (support@paruluniversity.ac.in) for credentials recovery.");
    });
  }

  // 5. Sign In Form Handler
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideMessages();

      const email = loginEmail.value.trim();
      const password = loginPassword.value.trim();

      if (!email || !password) {
        showError("Please enter your email or username and password.");
        return;
      }

      setLoading(signInSubmitBtn, true, "Verifying credentials...");

      // Try local backend first, then remote backend if available
      let response = null;
      const endpointsToTry = [
        "http://localhost:5000/api/auth/login",
        "https://campus-complaint-backend-vi2w.onrender.com/api/auth/login"
      ];

      for (const url of endpointsToTry) {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
          });
          // 404 indicates the auth route is not deployed on this server yet
          if (res.status === 404) continue;
          response = res;
          break;
        } catch (err) {
          // Server offline or connection refused, try next endpoint
          continue;
        }
      }

      // If a backend server with /api/auth/login route responded:
      if (response) {
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          // Strictly reject wrong credentials
          showError(data.error || "Invalid email or password. Please verify your credentials.");
          setLoading(signInSubmitBtn, false, "Sign In to Dashboard");
          return;
        }

        // Authentication Success via Backend
        saveSession(data.user, data.token);
        showSuccess("Authentication successful! Redirecting to dashboard...");
        setTimeout(redirectToDashboard, 600);
        return;
      }

      // Fallback when backend is offline or route pending deployment:
      // STRICT VERIFICATION: ONLY EXACT MATCHES ACCEPTED. RANDOM PASSWORDS ARE ALWAYS REJECTED.
      const localUsers = getLocalRegisteredUsers();
      const matchedLocal = localUsers.find(
        u => (u.email.toLowerCase() === email.toLowerCase() || u.name.toLowerCase() === email.toLowerCase()) && u.password === password
      );
      const isDefaultAdmin =
        (email.toLowerCase() === "divya@paruluniversity.ac.in" || email.toLowerCase() === "divya") &&
        password === "Admin@123";

      if (isDefaultAdmin || matchedLocal) {
        const userObj = matchedLocal
          ? { id: matchedLocal.id, name: matchedLocal.name, email: matchedLocal.email, role: matchedLocal.role }
          : { id: "usr_admin_default", name: "Divya Prajapati", email: "divya@paruluniversity.ac.in", role: "Admin" };

        saveSession(userObj, "verified_session_token_" + Date.now());
        showSuccess("Login successful! Redirecting to dashboard...");
        setTimeout(redirectToDashboard, 600);
      } else {
        // Strictly reject random passwords
        showError("Invalid email or password. Random passwords are not permitted.");
        setLoading(signInSubmitBtn, false, "Sign In to Dashboard");
      }
    });
  }

  // 6. Register / Create Account Form Handler
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideMessages();

      const name = regName.value.trim();
      const email = regEmail.value.trim();
      const role = regRole.value;
      const password = regPassword.value.trim();

      if (!name || !email || !password) {
        showError("Please complete all registration fields.");
        return;
      }

      if (password.length < 6) {
        showError("Password must be at least 6 characters long.");
        return;
      }

      setLoading(registerSubmitBtn, true, "Creating your account...");

      let response = null;
      const endpointsToTry = [
        "http://localhost:5000/api/auth/register",
        "https://campus-complaint-backend-vi2w.onrender.com/api/auth/register"
      ];

      for (const url of endpointsToTry) {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, role, password })
          });
          if (res.status === 404) continue;
          response = res;
          break;
        } catch (err) {
          continue;
        }
      }

      if (response) {
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          showError(data.error || "Failed to create account. Please try again.");
          setLoading(registerSubmitBtn, false, "Create Account");
          return;
        }

        saveSession(data.user, data.token);
        showSuccess("Account registered successfully! Redirecting...");
        setTimeout(redirectToDashboard, 600);
        return;
      }

      // Fallback local registration
      const localUsers = getLocalRegisteredUsers();
      if (localUsers.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        showError("An account with this email already exists.");
        setLoading(registerSubmitBtn, false, "Create Account");
        return;
      }

      const newUser = {
        id: "usr_local_" + Date.now(),
        name,
        email,
        role,
        password
      };
      localUsers.push(newUser);
      saveLocalRegisteredUsers(localUsers);

      saveSession(newUser, "local_token_" + Date.now());
      showSuccess("Account created successfully! Redirecting...");
      setTimeout(redirectToDashboard, 600);
    });
  }

  // Helper Functions
  function showError(msg) {
    if (errorMsg) {
      errorMsg.textContent = msg;
      errorMsg.style.display = "block";
    }
    if (successMsg) successMsg.style.display = "none";
  }

  function showSuccess(msg) {
    if (successMsg) {
      successMsg.textContent = msg;
      successMsg.style.display = "block";
    }
    if (errorMsg) errorMsg.style.display = "none";
  }

  function hideMessages() {
    if (errorMsg) errorMsg.style.display = "none";
    if (successMsg) successMsg.style.display = "none";
  }

  function setLoading(button, isLoading, text) {
    if (!button) return;
    button.disabled = isLoading;
    button.innerHTML = `<span>${text}</span>`;
  }

  function saveSession(user, token) {
    const sessionData = {
      id: user.id || user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: token,
      loggedInAt: new Date().toISOString()
    };

    try {
      localStorage.setItem("parul_auth_user", JSON.stringify(sessionData));
      localStorage.setItem("parul_user_profile", JSON.stringify({
        name: user.name,
        email: user.email,
        role: user.role,
        initial: (user.name ? user.name.trim().charAt(0) : "D").toUpperCase()
      }));
    } catch (e) {
      console.error("Failed to save auth session to localStorage:", e);
    }
  }

  function redirectToDashboard() {
    const isInsidePages =
      window.location.pathname.includes("/pages/") ||
      window.location.pathname.includes("\\pages\\") ||
      window.location.href.includes("/pages/");
    window.location.href = isInsidePages ? "../index.html" : "index.html";
  }

  function getLocalRegisteredUsers() {
    try {
      const raw = localStorage.getItem("parul_local_registered_users");
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocalRegisteredUsers(users) {
    try {
      localStorage.setItem("parul_local_registered_users", JSON.stringify(users));
    } catch (e) {
      console.error("Could not save local users:", e);
    }
  }
});
