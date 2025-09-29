import twelve from "../Models/McqModel.js";
import cloudinary from '../Utils/Cloudinary.js';
import MockQuestions from "../Models/MockQuestionModel.js";
import FlaggedQuestion from "../Models/FlaggedquestionsModel.js";
import TimeQuestions from "../Models/TimeQuestionModel.js";
import mongoose from "mongoose";


export const createTwelfthQuestion = async (req, res) => {
  try {
    const {
      courseName,
      statement,
      subQuestions,
      question,
      options,
      correctAnswer,
      difficulty,
      subject,
      topic,
      syllabus,
      Standard,
      category,
      explainerVideoUrl,
      slideDocumentUrl,
      sourceType,
    } = req.body;


    const processedOptions = await Promise.all(
      options.map(async (op) => {
        let diagramUrl = op.diagramUrl || null; // take existing url if provided

        if (op.imageFile) {
          const uploadRes = await cloudinary.uploader.upload(op.imageFile, {
            folder: "mcq_options",
          });
          diagramUrl = uploadRes.secure_url;
        }

        return { text: op.text, diagramUrl };
      })
    );

    const newQuestion = new twelve({
      courseName,
      statement,
      subQuestions,
      question,
      options: processedOptions,
      correctAnswer,
      difficulty,
      subject,
      topic,
      syllabus,
      Standard,
      category,
      explainerVideoUrl,
      slideDocumentUrl,
      sourceType,
    });

    await newQuestion.save();
    res.status(201).json({
      message: "Question created successfully",
      question: newQuestion,
    });
  } catch (error) {
    console.error("Error creating question:", error);
    res.status(500).json({ message: "Error creating question", error });
  }
};


export const createBulkTwelfthQuestions = async (req, res) => {

  try {
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "Questions array is required" });
    }

    // Validate each question
    const invalid = questions.find(
      (q) =>
        !q.courseId ||
        !q.question ||
        !q.options ||
        !q.correctAnswer ||
        !q.subject ||
        !q.topic ||
        !q.syllabus
    );

    if (invalid) {
      return res
        .status(400)
        .json({ message: "Some questions are missing required fields" });
    }

    // Insert all questions
    const newQuestions = await twelve.insertMany(questions);

    res
      .status(201)
      .json({
        message: "Bulk questions created successfully",
        count: newQuestions.length,
        questions: newQuestions,
      });
  } catch (error) {
    res.status(500).json({ message: "Error creating bulk questions", error: error.message });
  }
};


export const checkMockAnswerById = async (req, res) => {
  try {
    const { questionId } = req.params;

    console.log("question", req.params);

    const { userAnswer, userId } = req.body;

    console.log("body", req.body);


    if (!questionId || !userAnswer || !userId) {
      return res.status(400).json({
        message: "questionId, userAnswer and userId are required",
      });
    }

    // Find the question details
    const question = await twelve.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    console.log("question", question);


    // Check correctness
    const isCorrect =
      question.correctAnswer.trim().toLowerCase() ===
      userAnswer.trim().toLowerCase();

    // Find the active mock quiz
    const quiz = await MockQuestions.findOne({ userId, isActive: true });
    if (!quiz) {
      return res.status(404).json({ message: "Active quiz not found" });
    }

    // Update the question status in the quiz
    const idx = quiz.questions.findIndex(
      (q) => q.questionId.toString() === questionId.toString()
    );
    if (idx === -1) {
      return res.status(404).json({ message: "Question not found in quiz" });
    }

    // Update question details
    quiz.questions[idx].status = isCorrect ? "correct" : "incorrect";
    quiz.questions[idx].attempts += 1;
    quiz.questions[idx].answeredAt = new Date();

    // Update progress
    quiz.progress.completedQuestions += 1;
    if (isCorrect) quiz.progress.correctAnswers += 1;
    else quiz.progress.wrongAnswers += 1;

    // Move current question to next one
    let nextIndex = idx + 1;
    if (nextIndex >= quiz.questions.length) {
      // All done
      quiz.progress.status = "completed";
      quiz.isActive = false;
      quiz.currentQuestion = { index: nextIndex, questionId: null };
    } else {
      quiz.progress.status = "in_progress";
      quiz.currentQuestion = {
        index: nextIndex,
        questionId: quiz.questions[nextIndex].questionId,
      };
    }

    await quiz.save();

    return res.status(200).json({
      message: "Answer checked and quiz updated",
      questionId: question._id,
      userAnswer,
      isCorrect,
      correctAnswer: isCorrect ? undefined : question.correctAnswer,
      progress: quiz.progress,
      currentQuestion: quiz.currentQuestion,
    });
  } catch (error) {
    console.error("Error in checkMockAnswerById:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const MockBattle = async (req, res) => {
  try {
    let { StudentId, Standard, syllabus, Subject, FrequentlyAsked, ExamSimulation, topic } = req.body;

    console.log(req.body);

    // Convert booleans from string if needed
    FrequentlyAsked = FrequentlyAsked === "true" || FrequentlyAsked === true;
    ExamSimulation = ExamSimulation === "true" || ExamSimulation === true;

    // Validate input
    if (!StudentId || !Subject || !Standard || !syllabus || !topic || !Array.isArray(topic) || topic.length === 0) {
      return res.status(400).json({ message: "Some fields are missing or invalid" });
    }
    const existingCount = await MockQuestions.countDocuments({ userId: StudentId, subject: Subject,syllabus,Standard, isActive: true });
    if (existingCount > 0) {
      return res.status(201).json({ message: "You already have an active mock quiz. Please complete it before starting a new one." });
    }

    // Build the match condition
    const matchCondition = {
      subject: Subject,
      topic: { $in: topic },
      Standard: Standard,
      syllabus: syllabus
    };

    if (FrequentlyAsked) {
      matchCondition.FrequentlyAsked = true; // Add filter only if FrequentlyAsked is true
    }

    // Aggregation pipeline to group questions by topic
    const questionsByTopic = await twelve.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: "$topic",
          questions: { $push: "$$ROOT" }
        }
      },
      {
        $project: {
          topic: "$_id",
          questions: { $slice: ["$questions", 10] }, // Limit to 10 questions per topic
          _id: 0
        }
      }
    ]);

    if (questionsByTopic.length === 0) {
      return res.status(404).json({ message: "No questions found for the selected topics." });
    }

    const quizTopics = questionsByTopic.map(item => ({
      topic: item.topic,
      questions: item.questions,
      timeLimit: 30
    }));

    const totalTime = quizTopics.length * 30;

    // ✅ Create a new mock quiz regardless of existing active sessions
    const mockQuiz = await MockQuestions.create({
      userId: StudentId,
      subject: Subject,
      Standard: Standard,
      syllabus: syllabus,
      FrequentlyAsked: FrequentlyAsked,
      ExamSimulation: ExamSimulation,
      timeLimit: totalTime,
      isActive: true,
      questions: quizTopics.flatMap((topicObj, topicIndex) =>
        topicObj.questions.map((question, index) => ({
          questionId: question._id,
          index: index,
          topic: topicObj.topic,
          status: "pending",
          answeredAt: null,
          attempts: 0
        }))
      ),
    });

    // Initialize currentQuestion to the first question if available
    if (mockQuiz.questions.length > 0) {
      mockQuiz.currentQuestion = {
        index: 0,
        questionId: mockQuiz.questions[0].questionId,
      };
      mockQuiz.progress.status = "in_progress";
      await mockQuiz.save();
    }


    return res.status(200).json({
      message: "Mock quiz generated successfully.",
      quizId: mockQuiz._id,
      totalTime: totalTime,
      topics: quizTopics
    });

  } catch (error) {
    console.error("MockBattle error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const getMockQuestions = async (req, res) => {
  try {
    const {userId, subject , syllabus , Standard } = req.body;

    if (!subject) {
      return res.status(400).json({ message: "Subject is required" });
    }

    // Find the active mock quiz for the user and subject
    const quiz = await MockQuestions.findOne({ userId, subject, syllabus, Standard, isActive: true });
    console.log("quiz",quiz);
    
    if (!quiz) {
      return res.status(404).json({ message: "Active mock quiz not found for this subject" });
    }

    // Load full question documents
    const allIds = quiz.questions.map((q) => q.questionId);
    const fullQuestions = await twelve
      .find({ _id: { $in: allIds } })
      .select("_id question options correctAnswer");

    const getById = (id) => fullQuestions.find((q) => q._id.toString() === id.toString());

    // Map questions with details
    const mappedQuestions = quiz.questions.map((q) => {
      const details = getById(q.questionId);
      return {
        index: q.index,
        status: q.status,
        answeredAt: q.answeredAt,
        attempts: q.attempts,
        questionId: q.questionId,
        question: details?.question || "",
        options: details?.options || [],
        correctAnswer: details?.correctAnswer || "",
      };
    });

    // Get current question details if available
    let currentQuestion = null;
    if (quiz.currentQuestion && quiz.currentQuestion.questionId) {
      const cur = getById(quiz.currentQuestion.questionId);
      if (cur) {
        currentQuestion = {
          index: quiz.currentQuestion.index,
          question: cur.question,
          options: cur.options,
          correctAnswer: cur.correctAnswer,
        };
      }
    }

    res.status(200).json({
      message: "Mock quiz retrieved successfully",
      quizId: quiz._id,
      syllabus: quiz.syllabus,
      Standard: quiz.Standard,
      subject: quiz.subject,
      timeLimit: quiz.timeLimit,
      progress: quiz.progress,
      questions: mappedQuestions,
      currentQuestion,
    });
  } catch (error) {
    console.error("Error in getMockQuestions:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



export const flagQuestion = async (req, res) => {
  try {
    const { userId, questionId } = req.body;

    // Validate input
    if (!userId || !questionId ) {
      return res.status(400).json({ message: "Some fields are missing or invalid" });
    }

    // Convert IDs to ObjectId
    const questionObjectId = new mongoose.Types.ObjectId(questionId);
   

    // Find if a flagged question document exists for this user
    let flaggedDoc = await FlaggedQuestion.findOne({ userId });

    if (!flaggedDoc) {
      // Create new flagged question document with currentQuestion set to this question
      flaggedDoc = new FlaggedQuestion({
        userId,
        questions: [{
          questionId: questionObjectId,
          index: 0,
          status: "pending",
          answeredAt: null,
          attempts: 0
        }],
        currentQuestion: {
          index: 0,
          questionId: questionObjectId
        },
        progress: {
          completedQuestions: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          status: "not_started"
        },
        isActive: true
      });
    } else {
      // Check if the question already exists
      const exists = flaggedDoc.questions.some(q =>
        q.questionId.equals(questionObjectId)
      );

      if (exists) {
        return res.status(200).json({ message: "Question already flagged.", flaggedQuestion: flaggedDoc });
      }

      // Add new question with courseId
      flaggedDoc.questions.push({
        questionId: questionObjectId,
        index: flaggedDoc.questions.length,
        status: "pending",
        answeredAt: null,
        attempts: 0
      });

      // If this is the first question added (i.e., it was empty before), set currentQuestion
      if (flaggedDoc.questions.length === 1) {
        flaggedDoc.currentQuestion = {
          index: 0,
          questionId: questionObjectId
        };
      }
    }

    // Save the document
    await flaggedDoc.save();

    return res.status(200).json({
      message: "Question flagged successfully.",
      flaggedQuestion: flaggedDoc
    });

  } catch (error) {
    console.error("flagQuestion error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};


// ✅ Unflag Question Controller
export const unflagQuestion = async (req, res) => {
  try {
    const { userId, questionId } = req.body;

    if (!userId || !questionId) {
      return res.status(400).json({ message: "userId and questionId are required" });
    }

    const questionObjectId = new mongoose.Types.ObjectId(questionId);

    // Find the flagged document for this user
    let flaggedDoc = await FlaggedQuestion.findOne({ userId });
    if (!flaggedDoc) {
      return res.status(404).json({ message: "No flagged questions found for this user" });
    }

    // Find index of question in flagged list
    const qIndex = flaggedDoc.questions.findIndex((q) =>
      q.questionId.equals(questionObjectId)
    );

    if (qIndex === -1) {
      return res.status(404).json({ message: "Question not found in flagged list" });
    }

    // Remove the question
    flaggedDoc.questions.splice(qIndex, 1);

    // Reassign indexes for remaining questions
    flaggedDoc.questions.forEach((q, idx) => {
      q.index = idx;
    });

    // If the removed question was the current one, update currentQuestion
    if (
      flaggedDoc.currentQuestion &&
      flaggedDoc.currentQuestion.questionId?.toString() === questionObjectId.toString()
    ) {
      if (flaggedDoc.questions.length > 0) {
        flaggedDoc.currentQuestion = {
          index: 0,
          questionId: flaggedDoc.questions[0].questionId,
        };
      } else {
        flaggedDoc.currentQuestion = { index: 0, questionId: null };
      }
    }

    // If no questions remain, deactivate the flagged session
    if (flaggedDoc.questions.length === 0) {
      flaggedDoc.isActive = false;
      flaggedDoc.progress.status = "not_started";
      flaggedDoc.currentQuestion = { index: 0, questionId: null };
    }

    await flaggedDoc.save();

    return res.status(200).json({
      message: "Question unflagged successfully.",
      flaggedQuestion: flaggedDoc,
    });
  } catch (error) {
    console.error("unflagQuestion error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const checkFlaggedAnswerById = async (req, res) => {
  try {
    const { questionId } = req.params;
    const { userAnswer, userId } = req.body;

    if (!questionId || !userAnswer || !userId) {
      return res.status(400).json({ message: "questionId, userAnswer and userId are required" });
    }

    // Fetch question
    const question = await twelve.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    const isCorrect = question.correctAnswer.trim().toLowerCase() === userAnswer.trim().toLowerCase();

    // Find active flagged document
    const flaggedDoc = await FlaggedQuestion.findOne({ userId, isActive: true });
    if (!flaggedDoc) {
      return res.status(404).json({ message: "Active flagged session not found" });
    }

    // Find the question in flaggedDoc
    const idx = flaggedDoc.questions.findIndex(q => q.questionId.toString() === questionId.toString());
    if (idx === -1) {
      return res.status(404).json({ message: "Question not found in flagged questions" });
    }

    // Update question status
    flaggedDoc.questions[idx].status = isCorrect ? "correct" : "incorrect";
    flaggedDoc.questions[idx].attempts += 1;
    flaggedDoc.questions[idx].answeredAt = new Date();

    // Update progress
    flaggedDoc.progress.completedQuestions += 1;
    if (isCorrect) flaggedDoc.progress.correctAnswers += 1;
    else flaggedDoc.progress.wrongAnswers += 1;
    flaggedDoc.progress.status = "in_progress";

    // Move currentQuestion to the next unanswered question if exists
    const nextQuestion = flaggedDoc.questions.find(q => q.status === "pending");
    if (nextQuestion) {
      flaggedDoc.currentQuestion = {
        index: nextQuestion.index,
        questionId: nextQuestion.questionId
      };
    } else {
      // All questions answered
      flaggedDoc.currentQuestion = { index: 0, questionId: null };
      flaggedDoc.progress.status = "completed";
      flaggedDoc.isActive = false;
    }

    await flaggedDoc.save();

    res.status(200).json({
      message: "Answer checked and flagged session updated",
      questionId: question._id,
      userAnswer,
      isCorrect,
      correctAnswer: isCorrect ? undefined : question.correctAnswer,
      progress: flaggedDoc.progress,
      currentQuestion: flaggedDoc.currentQuestion,
    });

  } catch (error) {
    console.error("Error in checkFlaggedAnswerById:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getAllFlaggedQuestions = async (req, res) => {
  try {
    const { userId, subject } = req.body;

    if (!subject) {
      return res.status(400).json({ message: "Subject is required" });
    }

    // Find the active flagged questions document for the user
    const flaggedDoc = await FlaggedQuestion.findOne({ userId, isActive: true });

    if (!flaggedDoc || flaggedDoc.questions.length === 0) {
      return res.status(404).json({ message: "No flagged questions found" });
    }

    // Filter questions by subject
    const questionIds = flaggedDoc.questions.map(q => q.questionId);

    const questions = await twelve.find({ _id: { $in: questionIds }, subject })
      .select("_id question options correctAnswer");

    if (!questions.length) {
      return res.status(404).json({ message: "No flagged questions found for this subject" });
    }

    // Map flagged questions with details
    const mappedQuestions = flaggedDoc.questions.map(q => {
      const details = questions.find(detail => detail._id.toString() === q.questionId.toString());
      if (!details) return null;
      return {
        index: q.index,
        questionId: q.questionId,
        question: details.question,
        options: details.options,
        correctAnswer: details.correctAnswer,
        status: q.status,
        answeredAt: q.answeredAt,
        attempts: q.attempts,
        courseId: q.courseId,
      };
    }).filter(q => q !== null);

    // Get current question details if available
    let currentQuestion = null;
    if (flaggedDoc.currentQuestion && flaggedDoc.currentQuestion.questionId) {
      const cur = questions.find(q => q._id.toString() === flaggedDoc.currentQuestion.questionId.toString());
      if (cur) {
        currentQuestion = {
          index: flaggedDoc.currentQuestion.index,
          questionId: cur._id,
          question: cur.question,
          options: cur.options,
          correctAnswer: cur.correctAnswer,
        };
      }
    }

    res.status(200).json({
      message: "Flagged questions retrieved successfully",
      questions: mappedQuestions,
      currentQuestion,
      progress: flaggedDoc.progress,
    });
  } catch (error) {
    console.error("Error in getAllFlaggedQuestions:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const createTimeQuiz = async (req, res) => {
  try {
    const { StudentId, Standard, syllabus, Subject, challangeTime, WrongQuestionsLimit } = req.body;

    if (!StudentId || !Subject || !challangeTime || !WrongQuestionsLimit) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const questionCountPerSection = 10;
    const totalQuestions = Math.floor((challangeTime * 60) / 30); // 30 sec per question
    const numberOfSections = Math.ceil(totalQuestions / questionCountPerSection);
    const totalNeeded = numberOfSections * questionCountPerSection;

    const randomQuestions = await twelve.aggregate([
      { $match: { subject: Subject } },
      { $sample: { size: totalNeeded } }
    ]);

    if (randomQuestions.length === 0) {
      return res.status(404).json({ message: "No questions available for this subject" });
    }

    // Group questions into sections using reduce
    const sections = randomQuestions.reduce((acc, question, index) => {
      const sectionIndex = Math.floor(index / questionCountPerSection);
      if (!acc[sectionIndex]) {
        acc[sectionIndex] = { questions: [] };
      }
      acc[sectionIndex].questions.push({
        questionId: question._id,
        index: acc[sectionIndex].questions.length,
        status: "pending",
        attempts: 0,
        answeredAt: null,
      });
      return acc;
    }, []);

    const newQuiz = new TimeQuestions({
      userId: StudentId,
      subject: Subject,
      Standard,
      syllabus,
      challangeTime,
      WrongQuestionsLimit,
      timeLimit: challangeTime,
      sections,
      currentQuestion: {
        sectionIndex: 0,
        questionIndex: 0
      },
      progress: {
        completedQuestions: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        status: "not_started",
      },
      isActive: true,
    });

    await newQuiz.save();

    return res.status(201).json({
      message: "Timed quiz created successfully",
      quizId: newQuiz._id,
      sections: newQuiz.sections,
      currentQuestion: newQuiz.sections[0]?.questions[0] || null,
      progress: newQuiz.progress,
    });

  } catch (error) {
    console.error("Error creating timed quiz:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};



export const checkTimeAnswerById = async (req, res) => {
  try {
    const { questionId } = req.params; // string
    const { userAnswer, userId } = req.body;

    if (!questionId || !userAnswer || !userId) {
      return res.status(400).json({
        message: "questionId, userAnswer and userId are required",
      });
    }

    // ✅ Get the actual question from master collection
    const question = await twelve.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    const isCorrect =
      question.correctAnswer.trim().toLowerCase() ===
      userAnswer.trim().toLowerCase();

    // ✅ Find active quiz
    const quiz = await TimeQuestions.findOne({ userId, isActive: true });
    if (!quiz) {
      return res.status(404).json({ message: "Active quiz not found" });
    }

    // ✅ Locate the question: prefer current pointer, otherwise search across sections
    let { sectionIndex, questionIndex } = quiz.currentQuestion;
    let section = quiz.sections[sectionIndex];
    let currentQ = section?.questions?.[questionIndex];

    if (!currentQ || currentQ.questionId.toString() !== questionId.toString()) {
      let found = null;
      for (let sIdx = 0; sIdx < quiz.sections.length; sIdx++) {
        const sec = quiz.sections[sIdx];
        for (let qIdx = 0; qIdx < sec.questions.length; qIdx++) {
          const q = sec.questions[qIdx];
          if (q.questionId.toString() === questionId.toString()) {
            found = { sectionIndex: sIdx, questionIndex: qIdx, section: sec, question: q };
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        return res.status(404).json({ message: "Question not found in quiz" });
      }

      sectionIndex = found.sectionIndex;
      questionIndex = found.questionIndex;
      section = found.section;
      currentQ = found.question;
    }

    // ✅ Update question
    currentQ.status = isCorrect ? "correct" : "incorrect";
    currentQ.attempts += 1;
    currentQ.answeredAt = new Date();

    // ✅ Update progress
    quiz.progress.completedQuestions += 1;
    if (isCorrect) quiz.progress.correctAnswers += 1;
    else quiz.progress.wrongAnswers += 1;

    // ✅ Enforce wrong answers limit if configured
    if (
      typeof quiz.WrongQuestionsLimit === "number" &&
      quiz.WrongQuestionsLimit > 0 &&
      quiz.progress.wrongAnswers >= quiz.WrongQuestionsLimit
    ) {
      quiz.progress.status = "completed";
      quiz.isActive = false;
      await quiz.save();
      return res.status(400).json({
        message: "Wrong answer limit exceeded",
        questionId: question._id,
        userAnswer,
        isCorrect,
        correctAnswer: isCorrect ? undefined : question.correctAnswer,
        progress: quiz.progress,
        currentQuestion: null,
        quiz,
      });
    }

    // ✅ Move pointer to next question
    let nextSectionIndex = sectionIndex;
    let nextQuestionIndex = questionIndex + 1;

    if (nextQuestionIndex >= section.questions.length) {
      nextSectionIndex += 1;
      nextQuestionIndex = 0;
    }

    if (nextSectionIndex >= quiz.sections.length) {
      quiz.progress.status = "completed";
      quiz.isActive = false;
      quiz.currentQuestion = { sectionIndex: 0, questionIndex: 0 };
    } else {
      quiz.progress.status = "in_progress";
      quiz.currentQuestion = {
        sectionIndex: nextSectionIndex,
        questionIndex: nextQuestionIndex,
      };
    }

    await quiz.save();

    return res.status(200).json({
      message: "Answer checked and quiz updated",
      questionId: question._id,
      userAnswer,
      isCorrect,
      correctAnswer: isCorrect ? undefined : question.correctAnswer,
      progress: quiz.progress,
      currentQuestion: quiz.isActive
        ? quiz.sections[quiz.currentQuestion.sectionIndex].questions[
            quiz.currentQuestion.questionIndex
          ]
        : null,
    });
  } catch (error) {
    console.error("Error in checkTimeAnswerById:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

export const getTimedQuiz = async (req, res) => {
  try {
    const { userId, subject } = req.body;

    if (!subject) {
      return res.status(400).json({ message: "Subject is required" });
    }

    // ✅ Find the existing quiz
    const existingQuiz = await TimeQuestions.findOne({
      userId,
      subject,
      isActive: true,
    });

    if (!existingQuiz) {
      return res.status(404).json({ message: "No active quiz found" });
    }

    // ✅ Collect all question IDs from all sections
    const allQuestionIds = [];
    existingQuiz.sections.forEach((section) => {
      section.questions.forEach((q) => {
        allQuestionIds.push(q.questionId);
      });
    });

    // ✅ Fetch question details
    const fullQuestions = await twelve
      .find({ _id: { $in: allQuestionIds } })
      .select("_id question options correctAnswer");

    // ✅ Map questions with full details
    const mapQuestions = (section) =>
      section.questions.map((q) => {
        const details = fullQuestions.find(
          (fq) => fq._id.toString() === q.questionId.toString()
        );
        return {
          ...q.toObject(),
          question: details?.question,
          options: details?.options,
          correctAnswer: details?.correctAnswer,
        };
      });

    // ✅ Map each section
    const mappedSections = existingQuiz.sections.map((section) => ({
      questions: mapQuestions(section),
    }));

    // ✅ Map current question
    const section = existingQuiz.sections[existingQuiz.currentQuestion.sectionIndex];
    const currentQ = section.questions[existingQuiz.currentQuestion.questionIndex];
    const currentDetails = fullQuestions.find(
      (fq) => fq._id.toString() === currentQ.questionId.toString()
    );
    const mappedCurrent = {
      ...currentQ.toObject(),
      question: currentDetails?.question,
      options: currentDetails?.options,
      correctAnswer: currentDetails?.correctAnswer,
    };

    // ✅ Send the full mapped response
    return res.status(200).json({
      message: "Timed quiz retrieved successfully",
      quizId: existingQuiz._id,
      subject: existingQuiz.subject,
      sections: mappedSections,
      currentQuestion: mappedCurrent,
      progress: existingQuiz.progress,
    });

  } catch (error) {
    console.error("Error retrieving timed quiz:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
};



export const submitTimeAnswer = async (req, res) => {
  try {
    const { quizId, sectionIndex, questionIndex, answer } = req.body;

    const quiz = await TimeQuestions.findById(quizId);

    if (!quiz || !quiz.isActive) {
      return res.status(404).json({ message: "Quiz not found or inactive" });
    }

    const section = quiz.sections[sectionIndex];
    if (!section) {
      return res.status(400).json({ message: "Invalid section index" });
    }

    const questionEntry = section.questions[questionIndex];
    if (!questionEntry || questionEntry.status !== "pending") {
      return res.status(400).json({ message: "Invalid or already answered question" });
    }

    const question = await twelve.findById(questionEntry.questionId);

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    // Check if answer is correct
    const isCorrect = question.correctAnswer === answer;

    // Update question status
    questionEntry.status = isCorrect ? "correct" : "incorrect";
    questionEntry.answeredAt = new Date();
    questionEntry.attempts += 1;

    // Update quiz progress
    quiz.progress.completedQuestions += 1;
    if (isCorrect) {
      quiz.progress.correctAnswers += 1;
    } else {
      quiz.progress.wrongAnswers += 1;
    }

    // Check if wrong limit is exceeded
    if (quiz.progress.wrongAnswers >= quiz.WrongQuestionsLimit) {
      quiz.isActive = false;
      await quiz.save();
      return res.status(400).json({ message: "Wrong answer limit exceeded", quiz });
    }

    // Move to next question
    let nextSectionIndex = sectionIndex;
    let nextQuestionIndex = questionIndex + 1;

    if (nextQuestionIndex >= section.questions.length) {
      nextSectionIndex += 1;
      nextQuestionIndex = 0;
    }

    if (nextSectionIndex >= quiz.sections.length) {
      quiz.progress.status = "completed";
      quiz.isActive = false;
    } else {
      quiz.currentQuestion.sectionIndex = nextSectionIndex;
      quiz.currentQuestion.questionIndex = nextQuestionIndex;
      if (quiz.progress.status === "not_started") {
        quiz.progress.status = "in_progress";
      }
    }

    await quiz.save();

    const nextSection = quiz.sections[quiz.currentQuestion.sectionIndex];
    const nextQuestion = nextSection?.questions[quiz.currentQuestion.questionIndex] || null;

    return res.status(200).json({
      message: isCorrect ? "Correct answer" : "Incorrect answer",
      quiz,
      nextQuestion,
    });

  } catch (error) {
    console.error("Error submitting answer:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};



