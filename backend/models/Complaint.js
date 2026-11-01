const mongoose = require("mongoose");

const ComplaintSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true
    },
    date: {
      type: String,
      required: true
    },
    createdAt: {
      type: String,
      default: () => new Date().toISOString().slice(0, 10)
    },
    complainant: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true
    },
    status: {
      type: String,
      default: "Open",
      enum: ["Open", "In Progress", "Closed"]
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Complaint", ComplaintSchema);
