import express from "express";
import { checkAnswerById, checkMissedAnswer, createMissedQuestions, createPraticePlan, createRandomQuestions, getMissedQuestions, getPracticePlanQuestions, getQuestionBySectionAndIndex, getRandomQuestion } from "../Controller/PracticeplanController.js";



const router = express.Router();

router.post('/CreatePraticePlan', createPraticePlan)
router.post('/CheckAnswer/:id', checkAnswerById)
router.get('/GetPracticePlanQuestions/:planId', getPracticePlanQuestions)
router.get('/GetQuestion/:planId/:section/:questionIndex', getQuestionBySectionAndIndex)
router.post('/CreateRandomQuestions', createRandomQuestions)
router.post('/GetRandomQuestions', getRandomQuestion)
router.post('/CreateMissedQuestions', createMissedQuestions)
router.post('/GetMissedQuestions', getMissedQuestions)
router.post('/checkMissedAnswerById/:questionId', checkMissedAnswer)

export default router;