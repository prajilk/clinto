import mongoose from "mongoose";

const questionStatusSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PreviousQuestionPaper", // reference your question schema
    required: true,
  },
  // Index of the question inside the paper's questions array
  paperQuestionIndex: { type: Number, required: true },
  number: { type: Number, required: true }, // question order inside the section
  status: {
    type: String,
    enum: ["pending", "attempted", "correct", "incorrect"],
    default: "pending",
  },
  answeredAt: { type: Date, default: null },
  attempts: { type: Number, default: 0 },
});

const previousyearquestionsSchema = new mongoose.Schema(
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
    // Sections
    Section1: [questionStatusSchema],
    Section2: [questionStatusSchema],
    Section3: [questionStatusSchema],

    // Track the current question user is on
    currentQuestion: {
      section: { type: Number, enum: [1, 2, 3], default: 1 },
      questionIndex: { type: Number, default: 0 },
      questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PreviousQuestionPaper",
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

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("PreviousyearQuestions", previousyearquestionsSchema);
