import mongoose from "mongoose";

const optionSchema = new mongoose.Schema({
  text: {
    type: String,
    trim: true,
    required: true,
  },
  diagramUrl: {
    type: String, // Cloudinary image URL
    default: null,
  },
});

const twelfthSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: false, // make optional OR map properly
    },
    courseName: {
      type: String,
      trim: true,
    },
    statement: {
      type: String,
      trim: true,
    },
    subQuestions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SubQuestion",
        required: true,
      },
    ],
    question: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [optionSchema],
      required: true,
    },
    correctAnswer: {
      type: String,
      required: true,
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "easy",
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    FrequentlyAsked: {
      type: Boolean,
      default: false,
    },
    unit: {
      type: String,
      required: true,
    },
    unitNumber: {
      type: Number,
      required: true,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    diagramUrl: {
      type: String,
      default: null,
    },
    syllabus: {
      type: String,
      enum: ["CBSE", "ICSE", "State Board", "SAT", "Other"],
      required: true,
      trim: true,
    },
    Standard: {
      type: String,
      enum: ["12"],
      default: "12",
      required: true,
    },
    category: {
      type: String,
      trim: true,
    },
    explainerVideoUrl: {
      type: String,
      default: null,
    },
    slideDocumentUrl: {
      type: String,
      default: null,
    },
    sourceType: {
      type: String,
      enum: ["AI", "PDF", "Manual", "Other"],
      required: true,
      default: "Manual",
    },
  },
  { timestamps: true }
);

export default mongoose.model("twelve", twelfthSchema);
