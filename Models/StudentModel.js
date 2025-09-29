import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    FullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
    },
    countryCode: {
      type: String,
      trim: true,
    },
    phoneNumber: {
      type: String,
    },
    praticeMode: {
      type: String,
      enum: ["Getting Started", "On My Way", "Confident", "Pro Level"],
    },
    schoolName: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    dateofBirth: {
      type: String,
    },
    Gender: {
      type: String,
    },
    Nationality: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    classStandard: {
      type: String,
      trim: true,
    },
    syllabus: {
      type: String,
      trim: true,
    },
    leadSource: {
      type: String,
      default: null,
    },
    leadOwner: {
      type: String,
      default: null,
    },
    lastLoginDate: {
      type: Date,
    },
    referralCode: {
      type: String,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      default: null,
    },
    referralBonusEarned: {
      type: Boolean,
      default: false,
    },
    userPreferences: [
      {
        practiceDuration: { type: String },
        questionCount: { type: String },
        preferredStudyTime: { type: String },
        preferredQuizDays: [{ type: String }],
        examDate: { type: String },
      }
    ],
    onBoarding: {
      type: String,
      default: "Not Started",
    }
  },
  { timestamps: true }
);

export default mongoose.model("Student", studentSchema);
