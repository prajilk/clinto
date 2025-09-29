import mongoose from "mongoose";


const customPraticePlanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    preferences: {
      standard: {
        type: String,
        enum: ["12"],
        default: "12",
        required: true,
      },
      syllabus: {
        type: String,
        enum: ["CBSE", "ICSE", "State Board", "SAT", "Other"],
        required: true,
      },
      subject: {
        type: String,
        required: true,
        trim: true,
      },
      totalQuestions: {
        type: Number,
        required: true,
      },
      preferredTime: [{ type: String, required: true }],
      examDate: {
        type: Date,
      },
      targetDate: {
        type: Date,
      },
      startDate: {
        type: Date,
        required: true,
      },
      endDate: {
        type: Date,
        required: true,
      },
      difficulty: {
        type: String,
        enum: ["easy", "medium", "hard"],
      },
      skipdays: {
        type: String,
      },
      skippedQuestions: {
        type: Number,
        default: 0,
      },
    },
    Section1: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "twelve",
          required: true,
        },
        number: { type: Number, required: true },
        status: {
          type: String,
          enum: ["pending", "attempted", "correct", "incorrect"],
          default: "pending",
        },
        answeredAt: Date,
        attempts: { type: Number, default: 0 },
      },
    ],
    Section2: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "twelve",
          required: true,
        },
        number: { type: Number, required: true },
        status: {
          type: String,
          enum: ["pending", "attempted", "correct", "incorrect"],
          default: "pending",
        },
        answeredAt: Date,
        attempts: { type: Number, default: 0 },
      },
    ],
    Section3: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "twelve",
          required: true,
        },
        number: { type: Number, required: true },
        status: {
          type: String,
          enum: ["pending", "attempted", "correct", "incorrect"],
          default: "pending",
        },
        answeredAt: Date,
        attempts: { type: Number, default: 0 },
      },
    ],
    currentQuestion: {
      section: { type: Number, enum: [1, 2, 3], default: 1 },
      questionIndex: { type: Number, default: 0 }, 
      questionId: { type: mongoose.Schema.Types.ObjectId, ref: "twelve", default: null },
    },
    progress: {
      completedQuestions: { type: Number, default: 0 },
      correctAnswers: { type: Number, default: 0 },
      wrongAnswers: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ["not_started", "in_progress", "completed"],
        default: "not_started",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("PracticePlan", customPraticePlanSchema);
