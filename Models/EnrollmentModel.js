import mongoose from "mongoose";

const enrollmentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true
  },
  enrolledCourses: [
    {
      courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
        required: true
      },
      enrollmentDate: {
        type: Date,
        default: Date.now
      }
    }
  ],
  preferredSubjects: [
    {
      type: String,
      trim: true
    }
  ]
}, { timestamps: true });

export default mongoose.model("Enrollment", enrollmentSchema);
