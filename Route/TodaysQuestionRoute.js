import express from "express"
import { checkTodaysAnswerById, createTodaysQuestions, getTodaysQuestions } from "../Controller/TodaysQuestionController.js";




const router = express.Router();


router.post("/CreateTodaysQuestion", createTodaysQuestions)
router.post("/GetTodaysQuestion", getTodaysQuestions)
router.post("/CheckTodaysAnswer/:questionId", checkTodaysAnswerById)



export default router;