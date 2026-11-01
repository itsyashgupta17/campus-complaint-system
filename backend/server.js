const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const Complaint = require("./models/Complaint");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB Connected Successfully!");
    console.log("Database:", mongoose.connection.name);

    // Remove legacy demo records (#C001 - #C006) so only actual data remains
    try {
      const demoResult = await Complaint.deleteMany({
        id: { $in: ["#C001", "#C002", "#C003", "#C004", "#C005", "#C006"] }
      });
      if (demoResult.deletedCount > 0) {
        console.log(`Cleaned ${demoResult.deletedCount} demo complaints from MongoDB.`);
      }
    } catch (cleanErr) {
      console.warn("Notice during demo cleanup:", cleanErr.message);
    }
  })
  .catch((error) => {
    console.error("MongoDB Connection Failed!");
    console.error(error.message);
  });

// API Routes

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

    // Determine the next #Cxxx ID
    const allComplaints = await Complaint.find({}, "id");
    let maxIdNumber = 0;
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
