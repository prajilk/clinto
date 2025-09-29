import mongoose from "mongoose";

const questionStatusSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "twelve", // your main question bank
    required: true,
  },
  number: { type: Number, required: true }, // order inside section
  status: {
    type: String,
    enum: ["pending", "attempted", "correct", "incorrect"],
    default: "pending",
  },
  answeredAt: { type: Date, default: null },
  attempts: { type: Number, default: 0 },
});

const personalizedPracticePlanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    syllabus: { type: String, default: "CBSE" },
    standard: { type: String, default: "12" },

    // Sections split
    Section1: [questionStatusSchema],
    Section2: [questionStatusSchema],
    Section3: [questionStatusSchema],

    // Track current question
    currentQuestion: {
      section: { type: Number, enum: [1, 2, 3], default: 1 },
      questionIndex: { type: Number, default: 0 },
      questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "twelve",
        default: null,
      },
    },

    // Progress summary
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

    // Personalized plan config
    personalizedConfig: {
      examConfig: {
        duration: Number,
        totalQuestions: Number,
        timePerQuestion: Number,
        startTime: Date,
        endTime: Date,
      },
      questionSources: [
        {
          source: String, // topics, previousYear, attempted, random
          count: Number,
          topics: [String],
          years: [Number],
          filter: Object,
        },
      ],
      createdAt: { type: Date, default: Date.now },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);


export default mongoose.model("PersonalizedPracticePlan", personalizedPracticePlanSchema);
