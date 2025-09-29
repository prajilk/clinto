import mongoose from "mongoose";

const optionSchema = new mongoose.Schema({
    text: {
        type: String,
        trim: true,
        required: true,
    },
    diagramUrl: {
        type: String,
        default: null,
    },
});

const previousQuestionSchema = new mongoose.Schema({
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
    diagramUrl: {
        type: String,
        default: null,
    },
    referenceUrl: {
        type: String,
        default: null,
    },
    FrequentlyAsked: {
        type: Boolean,
        default: false,
    },
    difficulty: {
        type: String,
        enum: ["easy", "medium", "hard"],
        default: "easy",
    },
});

const previousPaperSchema = new mongoose.Schema(
    {
        examYear: {
            type: Number,
            required: true,
        },
        examType: {
            type: String,
            enum: ["Board", "Entrance", "Scholarship", "Other"],
            required: true,
            trim: true,
        },
        subject: {
            type: String,
            required: true,
            trim: true,
        },
        syllabus: {
            type: String,
            enum: ["CBSE", "ICSE", "State Board", "SAT", "Other"],
            required: true,
            trim: true,
        },
        standard: {
            type: String,
            enum: ["4", "5", "6", "7", "8", "9", "10", "11", "12"],
            required: true,
        },
        paperName: {
            type: String,
            required: true,
            trim: true,
        },

        sourceType: {
            type: String,
            enum: ["AI", "PDF", "Manual", "Other"],
            required: true,
            default: "Manual",
        },
        questions: {
            type: [previousQuestionSchema],
            required: true,
        },
        notes: {
            type: String,
            trim: true,
            default: null,
        },
        unit: {
            type: String,
            required: true,
        },
    },
    { timestamps: true }
);

export default mongoose.model("PreviousQuestionPaper", previousPaperSchema);
