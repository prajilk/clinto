import mongoose from "mongoose";

const missedQuestionSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "twelve",
    required: true,
  },
  index: { type: Number, required: true }, // index/order of missed question
  status: {
    type: String,
    enum: ["incorrect"],
    default: "incorrect",
  },
  answeredAt: { type: Date, default: null },
  attempts: { type: Number, default: 0 },
});

const MissedQuestionsSchema = new mongoose.Schema(
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
    syllabus: {
      type: String,
    },
    standard: {
      type: String,
    },
    questions: [missedQuestionSchema], // all missed questions in one array
    // Track the current question
    currentQuestion: {
      index: { type: Number, default: 0 },
      questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "twelve",
        default: null,
      },
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

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("MissedQuestions", MissedQuestionsSchema);
