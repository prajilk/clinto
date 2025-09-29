import express from "express";
import { checkFlaggedAnswerById, checkMockAnswerById, checkTimeAnswerById, createBulkTwelfthQuestions, createTimeQuiz, createTwelfthQuestion, flagQuestion, getAllFlaggedQuestions, getMockQuestions, getTimedQuiz, MockBattle, submitTimeAnswer, unflagQuestion } from "../Controller/McqController.js";




const router = express.Router();

router.post('/CreateMcq', createTwelfthQuestion)
router.post('/CreateBlukMcq', createBulkTwelfthQuestions)
router.post('/CreateMockQuestions', MockBattle)
router.post('/GetMockQuestions', getMockQuestions)
router.post('/checkAnswer/:questionId', checkMockAnswerById)
router.post('/CreateTimedMockQuestions', createTimeQuiz)
router.post('/CheckTimedMockQuiz/:questionId',checkTimeAnswerById)
router.post('/GetTimedMockQuestions',getTimedQuiz)
router.post('/CheckTimeQuiz', submitTimeAnswer)
router.post('/CreateCollectedQuestion', flagQuestion)
router.post('/UnflagQuestion', unflagQuestion)
router.post('/GetCollectedQuestion',getAllFlaggedQuestions)
router.post('/CheckCollectedQuestion/:questionId',checkFlaggedAnswerById)


export default router;