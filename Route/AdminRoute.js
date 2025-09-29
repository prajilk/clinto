import express from "express";
import { AdminLogin, AdminSignup } from "../Controller/AdminController.js";



const router = express.Router();

router.post('/AdminRegister', AdminSignup)
router.post('/AdminLogin', AdminLogin)


export default router;