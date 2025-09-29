import express from "express";
import {
  generatePersonalizedMcq,
  getPersonalizedSession,
  getAvailableTopics,
  getAvailablePreviousYears,
  checkPersonalizedAnswerById
} from "../Controller/PersonalizedMcqController.js";

const router = express.Router();


router.post("/generate", generatePersonalizedMcq);
router.post("/getallpersonlizedquestions", getPersonalizedSession);
router.post("/topics", getAvailableTopics);
router.get("/previous-years", getAvailablePreviousYears);
router.post("/checkanswerbyid/:questionId", checkPersonalizedAnswerById)

export default router;

