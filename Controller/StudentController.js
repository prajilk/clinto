import Student from "../Models/StudentModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from 'dotenv'
import { OAuth2Client } from 'google-auth-library';
import { sendOtpEmail } from "../helper/mailer.js";
import connectDB from "../Database/connectDB.js";



dotenv.config();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const studentRegisterGoogle = async (req, res) => {
  try {
    const { email, fullName } = req.body;
    if (!email, !fullName) {
      return res.status(400).json({ message: "ID token is required" });
    }

    let student = await Student.findOne({ email });

    if (!student) {
      student = new Student({
        FullName: fullName,
        email: email,
        password: "", // Google signup users don't need password
      });
      await student.save();
    } else {
      const token = generateToken(student);
      return res.status(200).json({
        message: "Student already registered",
        student: {
          id: student._id,
          FullName: student.FullName,
          email: student.email,
        },
        token
      });
    }

    const token = generateToken(student);

    return res.status(201).json({
      message: "Student signed up with Google successfully",
      student: {
        id: student._id,
        FullName: student.FullName,
        email: student.email,
      },
      token
    });
  } catch (error) {
    console.error("Google signup error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECERT_KEY, {
    expiresIn: '15d',
  })

}

export const updateStudentProfile = async (req, res) => {
  try {
    const { studentId } = req.params;

    // ✅ Allowed fields only
    const allowedUpdates = [
      "FullName",
      "email",
      "phoneNumber",
      "countryCode",
      "state",
      "dateofBirth",
      "Nationality",
    ];

    // Filter request body to only allowed fields
    const updates = {};
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields provided for update" });
    }

    // ✅ Run single DB update
    const updatedStudent = await Student.findByIdAndUpdate(
      studentId,
      { $set: updates },
      { new: true, runValidators: true } // return updated doc, apply schema validators
    );

    if (!updatedStudent) {
      return res.status(404).json({ message: "Student not found" });
    }

    return res.status(200).json({
      message: "Student profile updated successfully",
      student: {
        id: updatedStudent._id,
        FullName: updatedStudent.FullName,
        email: updatedStudent.email,
        phoneNumber: updatedStudent.phoneNumber,
        countryCode: updatedStudent.countryCode,
        state: updatedStudent.state,
        dateofBirth: updatedStudent.dateofBirth,
        Nationality: updatedStudent.Nationality,
      },
    });
  } catch (error) {
    console.error("Error updating student profile:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};



export const getStudentProfile = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      return res.status(400).json({ message: "Student ID is required" });
    }

    const student = await Student.findById(studentId).select(
      "FullName email phoneNumber countryCode state dateofBirth Nationality"
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    return res.status(200).json({
      message: "Student profile fetched successfully",
      student: {
        id: student._id,
        FullName: student.FullName,
        email: student.email,
        phoneNumber: student.phoneNumber,
        countryCode: student.countryCode,
        state: student.state,
        dateofBirth: student.dateofBirth,
        Nationality: student.Nationality,
      },
    });
  } catch (error) {
    console.error("Error fetching student profile:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const emailRegister = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Check if email exists and generate OTP in parallel
    const [existingEmail, otpCode] = await Promise.all([
      Student.findOne({ email }).lean(), // use lean for faster retrieval
      Promise.resolve(Math.floor(100000 + Math.random() * 900000).toString())
    ]);

    if (existingEmail) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const expiresAt = Date.now() + 20 * 60 * 1000; // 20 mins expiry

    // Send OTP but don't wait for it to complete before responding
    sendOtpEmail(email, otpCode).catch(err => {
      console.error("OTP email failed:", err.message);
    });

    // Respond immediately
    return res.status(200).json({
      message: "OTP sent to email",
      otp: otpCode,
      expiresAt: expiresAt
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const studentSignup = async (req, res) => {
  try {
    const {
      FullName,
      email,
      password,
      confirmPassword,
      countryCode,
      phoneNumber,
      schoolName,
      country,
      state,
      classStandard,
      dateofBirth,
      Nationality,
      Gender,
      syllabus,
      leadSource,
      leadOwner,
      onBoarding
    } = req.body;

    if (
      !email ||
      !password ||
      !confirmPassword

    ) {
      return res.status(400).json({ message: "All required feilds must be filled" })
    }


    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }


    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters long, include uppercase, lowercase, number, and special character",
      });
    }


    // const phoneRegex = /^[0-9]{7,15}$/;
    // if (!phoneRegex.test(phoneNumber)) {
    //   return res.status(400).json({ message: "Invalid phone number format" });
    // }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Password mismatch" })
    }


     

    await connectDB();

    const existingEmail = await Student.findOne({ email });
    if (existingEmail) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // 🔹 7. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 🔹 8. Create new student
    const newStudent = new Student({
      FullName,
      email,
      password: hashedPassword,
      countryCode,
      phoneNumber,
      schoolName,
      country,
      state,
      classStandard,
      dateofBirth,
      Nationality,
      Gender,
      syllabus,
      leadSource,
      leadOwner,
      onBoarding
    });

    await newStudent.save();

    return res.status(201).json({
      message: "Student registered successfully",
      student: {
        id: newStudent._id,
        FullName: newStudent.FullName,
        email: newStudent.email,
        phoneNumber: newStudent.phoneNumber,
        schoolName: newStudent.schoolName,
        country: newStudent.country,
        state: newStudent.state,
        onBoarding: newStudent.onBoarding
      },
    });
  } catch (error) {
    console.error("Error during student signup:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const updateStudentStandard = async (req, res) => {
  try {
    const { studentId } = req.params; // Student ID comes from route params
    const { classStandard, onBoarding } = req.body; // New class standard from request body

    if (!classStandard) {
      return res.status(400).json({ message: "classStandard is required" });
    }

    // 🔹 Check if student exists
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // 🔹 Update standard
    student.classStandard = classStandard;
    student.onBoarding = onBoarding || student.onBoarding; // Update onBoarding if provided
    await student.save();

    return res.status(200).json({
      message: "Student standard updated successfully",
      student: {
        id: student._id,
        FirstName: student.FirstName,
        LastName: student.LastName,
        email: student.email,
        classStandard: student.classStandard,
        onBoarding: student.onBoarding
      },
    });
  } catch (error) {
    console.error("Error updating student standard:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const studentLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if both fields exist
    if (!email || !password) {
      return res.status(400).json({ message: "Email and Password are required" });
    }


    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }


    const student = await Student.findOne({ email });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }


    const isMatch = await bcrypt.compare(password, student.password);



    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }


    const token = generateToken(student);
    res.cookie("jwt", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
      sameSite: "None", // ✅ required for cross-origin cookies
      maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days
    });



    // Successful login
    res.status(200).json({
      message: "Login successful",
      token: token,
      student: {
        id: student._id,
        firstName: student.FirstName,
        lastName: student.LastName,
        email: student.email,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};


export const studentLogout = (req, res) => {
  try {
    res.cookie("jwt", "", {
      httpOnly: true,
      expires: new Date(0),
      secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
      sameSite: "None", // ✅ required for cross-origin cookies
    });
    res.status(200).json({ message: "Logout successful" });

  } catch (error) {
    console.error("Logout Error:", error);
    res.status(500).json({ message: "Server error" });
  }
}


export const updatePraticeMode = async (req, res) => {
  try {
    const { studentId, praticeMode } = req.body

    // Validate input
    const validModes = ["Getting Started", "On My Way", "Confident", "Pro Level"];
    if (!validModes.includes(praticeMode)) {
      return res.status(400).json({ message: "Invalid practice mode." });
    }

    // Find the student and update the practice mode
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found." });
    }

    student.praticeMode = praticeMode;
    await student.save();

    res.status(200).json({
      message: "Practice mode updated successfully.",
      praticeMode: student.praticeMode,
    });
  } catch (error) {
    console.error("Error updating practice mode:", error);
    res.status(500).json({ message: "Server error." });
  }
};



export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const student = await Student.findOne({ email });
    if (!student || !student.otp || student.otp.code !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (student.otp.expiresAt < new Date()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    // OTP is valid → remove it
    student.otp = undefined;
    await student.save();

    return res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const updateUserPreferences = async (req, res) => {
  try {
    const { studentId } = req.params;
    const {
      practiceDuration,
      questionCount,
      preferredStudyTime,
      preferredQuizDays,
      examDate,
      onBoarding
    } = req.body;

    // Validate studentId
    if (!studentId) {
      return res.status(400).json({ message: "Student ID is required." });
    }

    // Validate at least one preference field is provided
    if (
      !practiceDuration &&
      !questionCount &&
      !preferredStudyTime &&
      (!preferredQuizDays || preferredQuizDays.length === 0) &&
      !examDate
    ) {
      return res.status(400).json({ message: "At least one preference must be provided." });
    }

    // Find the student
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found." });
    }

    // Create new preference object
    const newPreference = {
      practiceDuration,
      questionCount,
      preferredStudyTime,
      preferredQuizDays,
      examDate
    };

    // Add the new preference to the array
    student.userPreferences.push(newPreference);
    student.onBoarding = onBoarding || student.onBoarding; // Update onBoarding if provided
    await student.save();

    return res.status(200).json({
      message: "User preferences updated successfully.",
      userPreferences: student.userPreferences,
      OnBoarding: student.onBoarding
    });
  } catch (error) {
    console.error("Error updating user preferences:", error);
    return res.status(500).json({ message: "Server error.", error: error.message });
  }
};