const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const Complaint = require("./models/Complaint");
const User = require("./models/User");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "parul_campus_mgmt_jwt_secret_key_2026";

// Middleware
app.use(cors());
app.use(express.json());

// Token helper
function generateToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// Function to seed default admin user
async function seedDefaultAdmin() {
  try {
    const adminEmail = "divya@paruluniversity.ac.in";
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const defaultAdmin = new User({
        name: "Divya Prajapati",
        email: adminEmail,
        password: "Admin@123", // Will be automatically hashed by UserSchema pre-save hook
        role: "Admin"
      });
      await defaultAdmin.save();
      console.log("Default admin account created: divya@paruluniversity.ac.in / Admin@123");
    }
  } catch (err) {
    console.warn("Notice during admin user seeding:", err.message);
  }
}

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB Connected Successfully!");
    console.log("Database:", mongoose.connection.name);

    // Seed default admin account if not present
    await seedDefaultAdmin();
  })
  .catch((error) => {
    console.error("MongoDB Connection Failed!");
    console.error(error.message);
  });

// ================= AUTH ROUTES ================= //

// 1. POST /api/auth/login - Authenticate user credentials
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const trimmedInput = email.trim();
    const escapedInput = trimmedInput.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Search by email, username prefix (e.g. 'divya' for 'divya@...'), or name
    const user = await User.findOne({
      $or: [
        { email: trimmedInput.toLowerCase() },
        { email: new RegExp(`^${escapedInput}@`, "i") },
        { name: new RegExp(`^${escapedInput}$`, "i") },
        { name: new RegExp(`^${escapedInput}\\b`, "i") }
      ]
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid email/username or password." });
    }

    const isMatch = await user.matchPassword(password.trim());
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email/username or password." });
    }

    const token = generateToken(user);
    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Server error during login: " + error.message });
  }
});

// 2. POST /api/auth/register - Register a new user
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    if (password.trim().length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const newUser = new User({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: password.trim(),
      role: role || "Staff"
    });

    await newUser.save();
    const token = generateToken(newUser);

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Registration failed: " + error.message });
  }
});

// 3. GET /api/auth/me - Verify token & get current user
app.get("/api/auth/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized. Token missing." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json({ user });
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired session token." });
  }
});

// ================= COMPLAINTS ROUTES ================= //

// 1. GET /api/complaints - Get all complaints
app.get("/api/complaints", async (req, res) => {
  try {
    const complaints = await Complaint.find().sort({ createdAt: -1 });
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch complaints: " + error.message });
  }
});

// 2. POST /api/complaints - Create a new complaint
app.post("/api/complaints", async (req, res) => {
  try {
    const { complainant, category, title } = req.body;

    if (!complainant || !category || !title) {
      return res.status(400).json({ error: "Complainant, category, and title are required." });
    }

    // Determine the next #Cxxx ID (Starts from #C101)
    const allComplaints = await Complaint.find({}, "id");
    let maxIdNumber = 100;
    allComplaints.forEach((c) => {
      const match = /^#C(\d+)$/.exec(c.id);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxIdNumber) maxIdNumber = num;
      }
    });
    const newId = `#C${String(maxIdNumber + 1).padStart(3, "0")}`;

    const now = new Date();
    const dateFormatted = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

    const newComplaint = new Complaint({
      id: newId,
      date: dateFormatted,
      createdAt: now.toISOString().slice(0, 10),
      complainant,
      category,
      title,
      status: "Open"
    });

    const saved = await newComplaint.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ error: "Failed to create complaint: " + error.message });
  }
});

// 3. PATCH /api/complaints/:id/status - Update complaint status
app.patch("/api/complaints/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["Open", "In Progress", "Closed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value." });
    }

    const updated = await Complaint.findOneAndUpdate(
      { id: id },
      { status: status },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Complaint not found." });
    }

    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: "Failed to update status: " + error.message });
  }
});

// 4. DELETE /api/complaints/:id - Delete a specific complaint
app.delete("/api/complaints/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Complaint.findOneAndDelete({ id: id });
    if (!deleted) {
      return res.status(404).json({ error: "Complaint not found." });
    }
    res.json({ message: "Complaint deleted successfully.", complaint: deleted });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete complaint: " + error.message });
  }
});

// Root health check route
app.get("/", (req, res) => {
  res.send("Campus Management System Backend API is running!");
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
