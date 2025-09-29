import express from "express";
import { emailRegister, getStudentProfile, studentLogin, studentLogout, studentRegisterGoogle, studentSignup, updatePraticeMode, updateStudentProfile, updateStudentStandard, updateUserPreferences, verifyOtp } from "../Controller/StudentController.js";


const router = express.Router();

router.post('/StudentRegister', studentSignup)
router.post('/StudentLogin', studentLogin)
router.post('/StudentLogout', studentLogout)
router.post('/emailValidate', emailRegister)
router.put('/standardupdate/:studentId', updateStudentStandard)
router.put('/StudentPraticeMode', updatePraticeMode)
router.post('/googleLogin', studentRegisterGoogle)
router.post('/verifyOtp', verifyOtp)
router.post('/userPreferences/:studentId', updateUserPreferences);
router.post('/UpdateStudentProfile/:studentId', updateStudentProfile)
router.get('/GetStudentProfile/:studentId', getStudentProfile)

export default router;

