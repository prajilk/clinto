import mongoose from "mongoose";

const timeQuestionSchema = new mongoose.Schema({
    questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "twelve",
        required: true,
    },
    index: { type: Number, required: true },
    status: {
        type: String,
        enum: ["pending", "attempted", "correct", "incorrect"],
        default: "pending",
    },
    answeredAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
});

const TimeQuestionsSchema = new mongoose.Schema(
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
        Standard: {
            type: String,
        },
        syllabus: {
            type: String,
        },
        challangeTime: {
            type: Number,
            default: 0
        },
        WrongQuestionsLimit: {
            type: Number,
            default: 0
        },
        timeLimit: { type: Number, default: 0 },
        sections: [
            {
                questions: [timeQuestionSchema]
            }
        ],
        currentQuestion: {
            sectionIndex: { type: Number, default: 0 },
            questionIndex: { type: Number, default: 0 },
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

export default mongoose.model("TimeQuestions", TimeQuestionsSchema);
