import Course from "../Models/CourseModel.js";
import Enrollment from "../Models/EnrollmentModel.js";


export const createCourse = async (req, res) => {
  try {
    const { title, description, category, standerd, syllabus, startDate, endDate } = req.body;

    if (!title || !syllabus) {
      return res.status(400).json({ message: "Title, syllabus are required" });
    }

    const newCourse = new Course({
      title,
      description,
      category,
      syllabus,
      standerd,
      startDate,
      endDate,
    });

    await newCourse.save();
    res.status(201).json({ message: "Course created successfully", course: newCourse });
  } catch (error) {
    res.status(500).json({ message: "Error creating course", error: error.message });
  }
};


export const getAllCoursesforHighersecondary = async (req, res) => {
  try {
    // Instead of expecting a single classStandard, 
    // fetch all courses where standard is 10, 11, or 12
    const higherSecondaryStandards = ["10", "11", "12"];

    const courses = await Course.find({
      standerd: { $in: higherSecondaryStandards }
    }).sort({ createdAt: -1 });

    if (!courses || courses.length === 0) {
      return res.status(404).json({ message: "No higher secondary courses found" });
    }

    res.status(200).json({
      message: "Higher secondary courses retrieved successfully",
      count: courses.length,
      courses
    });
  } catch (error) {
    res.status(500).json({
      message: "Error retrieving courses",
      error: error.message
    });
  }
};



// Enroll or update enrollment
export const enrollCourses = async (req, res) => {
  try {
    const { studentId, courseIds, preferredSubjects } = req.body;

    // Find existing enrollment or create new
    let enrollment = await Enrollment.findOne({ studentId });

    if (!enrollment) {
      enrollment = new Enrollment({
        studentId,
        enrolledCourses: courseIds.map(id => ({ courseId: id })),
        preferredSubjects
      });
    } else {
      // Add new courses avoiding duplicates
      const existingCourseIds = enrollment.enrolledCourses.map(c => c.courseId.toString());
      const newCourses = courseIds
        .filter(id => !existingCourseIds.includes(id))
        .map(id => ({ courseId: id }));

      enrollment.enrolledCourses.push(...newCourses);

      // Update preferred subjects (merge and remove duplicates)
      enrollment.preferredSubjects = Array.from(new Set([...enrollment.preferredSubjects, ...preferredSubjects]));
    }

    await enrollment.save();

    res.status(200).json({
      message: "Enrollment updated successfully",
      enrollment
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get enrollment details
export const getEnrollment = async (req, res) => {
  try {
    const { studentId } = req.body;

    const enrollment = await Enrollment.findOne({ studentId })
      .populate("enrolledCourses.courseId", "title description");

    if (!enrollment) {
      return res.status(404).json({ message: "Enrollment not found" });
    }

    res.status(200).json({ enrollment });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};





