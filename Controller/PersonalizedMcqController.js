import twelve from "../Models/McqModel.js";
import RandomQuestions from '../Models/RandomquestionsModel.js';
import FlaggedQuestion from "../Models/FlaggedquestionsModel.js";
import PreviousQuestionPaper from "../Models/QuestionPaperModel.js"
import PersonalizedPracticePlan from "../Models/PersonalizedPraticePlanModel.js";


export const generatePersonalizedMcq = async (req, res) => {
  try {
    const {
      userId,
      subject,
      syllabus,
      standard,

      // Topic filtering
      selectedTopics = [],

      // Previous year questions
      includePreviousYear = false,
      previousYearYears = [],

      // Difficulty filtering
      difficultyLevels = ["easy", "medium", "hard"],

      // Exam simulation mode
      examSimulationMode = false,
      examDuration = 180, // minutes

      // Attempted questions filtering
      includeAttemptedQuestions = false,
      attemptedFilter = {
        correct: false,
        incorrect: false,
        flagged: false,
      },

      // Question count configuration
      totalQuestions,
      questionDistribution = {
        topics: 0.4, // 40% from topics
        previousYear: 0.3, // 30% from previous year
        attempted: 0.2, // 20% from attempted
        random: 0.1, // 10% random
      },
    } = req.body;

    // Validation
    if (!userId || !subject) {
      return res.status(400).json({
        message: "userId and subject are required",
      });
    }

    if (totalQuestions < 1 || totalQuestions > 100) {
      return res.status(400).json({
        message: "totalQuestions must be between 1 and 100",
      });
    }

    console.log("Generating personalized MCQ with criteria:", {
      userId,
      subject,
      selectedTopics,
      includePreviousYear,
      previousYearYears,
      difficultyLevels,
      examSimulationMode,
      includeAttemptedQuestions,
      attemptedFilter,
      totalQuestions,
    });

    // --- Step 1: Calculate initial distribution ---
    let topicQuestions = Math.floor(totalQuestions * questionDistribution.topics);
    let previousYearQuestions = Math.floor(totalQuestions * questionDistribution.previousYear);
    let attemptedQuestions = Math.floor(totalQuestions * questionDistribution.attempted);

    let allocated = topicQuestions + previousYearQuestions + attemptedQuestions;
    let randomQuestions = totalQuestions - allocated;

    let allQuestions = [];
    let questionSources = [];

    // --- Step 2: Fetch topic questions ---
    if (selectedTopics.length > 0 && topicQuestions > 0) {
      const topicQuestionsData = await fetchTopicQuestions({
        subject,
        syllabus,
        standard,
        topics: selectedTopics,
        difficultyLevels,
        count: topicQuestions,
      });

      allQuestions.push(...topicQuestionsData);
      questionSources.push({
        source: "topics",
        count: topicQuestionsData.length,
        topics: selectedTopics,
      });

      // if shortage, add to random pool
      if (topicQuestionsData.length < topicQuestions) {
        randomQuestions += topicQuestions - topicQuestionsData.length;
      }
    }

    // --- Step 3: Fetch previous year questions ---
    if (includePreviousYear && previousYearYears.length > 0 && previousYearQuestions > 0) {
      const previousYearData = await fetchPreviousYearQuestions({
        subject,
        syllabus,
        standard,
        years: previousYearYears,
        difficultyLevels,
        count: previousYearQuestions,
      });

      allQuestions.push(...previousYearData);
      questionSources.push({
        source: "previousYear",
        count: previousYearData.length,
        years: previousYearYears,
      });

      if (previousYearData.length < previousYearQuestions) {
        randomQuestions += previousYearQuestions - previousYearData.length;
      }
    }

    // --- Step 4: Fetch attempted questions ---
    if (includeAttemptedQuestions && attemptedQuestions > 0) {
      const attemptedData = await fetchAttemptedQuestions({
        userId,
        subject,
        attemptedFilter,
        count: attemptedQuestions,
      });

      allQuestions.push(...attemptedData);
      questionSources.push({
        source: "attempted",
        count: attemptedData.length,
        filter: attemptedFilter,
      });

      if (attemptedData.length < attemptedQuestions) {
        randomQuestions += attemptedQuestions - attemptedData.length;
      }
    }

    // --- Step 5: Fetch random questions (including leftover) ---
    if (randomQuestions > 0) {
      const randomData = await fetchRandomQuestions({
        subject,
        syllabus,
        standard,
        difficultyLevels,
        excludeIds: allQuestions.map((q) => q._id),
        count: randomQuestions,
      });

      allQuestions.push(...randomData);
      questionSources.push({
        source: "random",
        count: randomData.length,
      });
    }

    // --- Step 6: Deduplicate and shuffle ---
    const uniqueQuestions = removeDuplicates(allQuestions);
    let shuffledQuestions = shuffleArray(uniqueQuestions);

    // --- Step 7: Guarantee totalQuestions ---
    if (shuffledQuestions.length < totalQuestions) {
      const extraNeeded = totalQuestions - shuffledQuestions.length;
      const extraData = await fetchRandomQuestions({
        subject,
        syllabus,
        standard,
        difficultyLevels,
        excludeIds: shuffledQuestions.map((q) => q._id),
        count: extraNeeded,
      });
      shuffledQuestions.push(...extraData);
    }

    // trim if overshoot
    shuffledQuestions = shuffledQuestions.slice(0, totalQuestions);

    // --- Step 8: Exam config ---
    let examConfig = null;
    if (examSimulationMode) {
      examConfig = {
        duration: examDuration,
        totalQuestions: shuffledQuestions.length,
        timePerQuestion: Math.floor((examDuration * 60) / shuffledQuestions.length), // seconds
        startTime: new Date(),
        endTime: new Date(Date.now() + examDuration * 60 * 1000),
      };
    }

    // --- Step 9: Create session ---
    const personalizedSession = await createPersonalizedSession({
      userId,
      subject,
      questions: shuffledQuestions,
      examConfig,
      questionSources,
    });

    // --- Step 10: Normalize options ---
    const normalizeOptions = (options) =>
      options.map((opt) => {
        if (!opt) return { text: "" };
        if (typeof opt === "string") return { text: opt };

        if (typeof opt === "object") {
          const plain = typeof opt.toObject === "function" ? opt.toObject() : opt;
          if (plain.text && String(plain.text).trim() !== "") {
            return { text: String(plain.text).trim(), diagramUrl: plain.diagramUrl || null };
          }
          if (plain.diagramUrl && !plain.text) return { text: "", diagramUrl: String(plain.diagramUrl) };

          // Join numeric keys
          const joinedNumeric = Object.keys(plain)
            .filter((k) => !isNaN(k))
            .sort((a, b) => a - b)
            .map((k) => String(plain[k] ?? ""))
            .join("");
          if (joinedNumeric.trim() !== "") return { text: joinedNumeric };

          // Fallback: join string fields
          const stringValues = Object.entries(plain)
            .filter(
              ([key, value]) =>
                !["_id", "id", "__v", "diagramUrl"].includes(key) && typeof value === "string"
            )
            .map(([, value]) => value)
            .join(" ")
            .trim();
          if (stringValues !== "") return { text: stringValues };

          return { text: "" };
        }

        return { text: "" };
      });

    // --- Step 11: Response ---
    return res.status(200).json({
      message: "Personalized MCQ generated successfully",
      sessionId: personalizedSession._id,
      totalQuestions: shuffledQuestions.length,
      questionSources,
      examConfig,
      questions: shuffledQuestions.map((q, index) => ({
        questionId: q._id,
        questionNumber: index + 1,
        question: q.question,
        options: normalizeOptions(q.options || []),
        difficulty: q.difficulty,
        topic: q.topic,
        source: q.source || "mixed",
      })),
    });
  } catch (error) {
    console.error("Error generating personalized MCQ:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};


/**
 * Fetch questions from selected topics
 */
const fetchTopicQuestions = async ({ subject, syllabus, standard, topics, difficultyLevels, count }) => {
  try {
    const questions = await twelve.aggregate([
      {
        $match: {
          subject,
          syllabus,
          Standard: standard,
          topic: { $in: topics },
          difficulty: { $in: difficultyLevels }
        }
      },
      { $sample: { size: count * 2 } }, // Get more to ensure we have enough
      {
        $project: {
          _id: 1,
          question: 1,
          options: 1,
          correctAnswer: 1,
          difficulty: 1,
          topic: 1,
          subject: 1,
          source: { $literal: "topics" }
        }
      }
    ]);

    return questions.slice(0, count);
  } catch (error) {
    console.error("Error fetching topic questions:", error);
    return [];
  }
};

/**
 * Fetch previous year questions
 */
const fetchPreviousYearQuestions = async ({ subject, syllabus, standard, years, difficultyLevels, count }) => {
  try {
    const papers = await PreviousQuestionPaper.find({
      subject,
      syllabus,
      standard,
      examYear: { $in: years },
      difficulty: { $in: difficultyLevels }
    }).limit(count * 2);

    let questions = [];
    papers.forEach(paper => {
      paper.questions.forEach((question, index) => {
        if (questions.length < count) {
          questions.push({
            _id: `${paper._id}_${index}`, // Generate unique ID
            question: question.question,
            options: question.options,
            correctAnswer: question.correctAnswer,
            difficulty: paper.difficulty,
            topic: "Previous Year",
            subject: paper.subject,
            examYear: paper.examYear,
            examType: paper.examType,
            source: "previousYear"
          });
        }
      });
    });

    return questions.slice(0, count);
  } catch (error) {
    console.error("Error fetching previous year questions:", error);
    return [];
  }
};

/**
 * Fetch attempted questions based on user's history
 */
const fetchAttemptedQuestions = async ({ userId, subject, attemptedFilter, count }) => {
  try {
    let questionIds = [];

    // Get correct questions
    if (attemptedFilter.correct) {
      const correctQuestions = await RandomQuestions.find({
        userId,
        subject,
        isActive: false
      }).select('Section1 Section2 Section3');

      correctQuestions.forEach(session => {
        [...session.Section1, ...session.Section2, ...session.Section3]
          .filter(q => q.status === "correct")
          .forEach(q => questionIds.push(q.questionId));
      });
    }

    // Get incorrect questions
    if (attemptedFilter.incorrect) {
      const incorrectQuestions = await RandomQuestions.find({
        userId,
        subject,
        isActive: false
      }).select('Section1 Section2 Section3');

      incorrectQuestions.forEach(session => {
        [...session.Section1, ...session.Section2, ...session.Section3]
          .filter(q => q.status === "incorrect")
          .forEach(q => questionIds.push(q.questionId));
      });
    }

    // Get flagged questions
    if (attemptedFilter.flagged) {
      const flaggedSessions = await FlaggedQuestion.find({
        userId,
        isActive: true
      }).select('questions');

      flaggedSessions.forEach(session => {
        session.questions.forEach(q => questionIds.push(q.questionId));
      });
    }

    // Remove duplicates
    const uniqueIds = [...new Set(questionIds.map(id => id.toString()))];

    if (uniqueIds.length === 0) {
      return [];
    }

    // Fetch question details
    const questions = await twelve.find({
      _id: { $in: uniqueIds }
    }).select('_id question options correctAnswer difficulty topic subject')
      .limit(count);

    return questions.map(q => ({
      ...q.toObject(),
      source: "attempted"
    }));
  } catch (error) {
    console.error("Error fetching attempted questions:", error);
    return [];
  }
};

/**
 * Fetch random questions
 */
const fetchRandomQuestions = async ({ subject, syllabus, standard, difficultyLevels, excludeIds = [], count }) => {
  try {
    const matchQuery = {
      subject,
      syllabus,
      Standard: standard,
      difficulty: { $in: difficultyLevels }
    };

    if (excludeIds.length > 0) {
      matchQuery._id = { $nin: excludeIds };
    }

    const questions = await twelve.aggregate([
      { $match: matchQuery },
      { $sample: { size: count * 2 } },
      {
        $project: {
          _id: 1,
          question: 1,
          options: 1,
          correctAnswer: 1,
          difficulty: 1,
          topic: 1,
          subject: 1,
          source: { $literal: "random" }
        }
      }
    ]);

    return questions.slice(0, count);
  } catch (error) {
    console.error("Error fetching random questions:", error);
    return [];
  }
};

/**
 * Create personalized session
 */
const createPersonalizedSession = async ({
  userId,
  subject,
  questions,
  examConfig,
  questionSources,
  syllabus,
  standard,
}) => {
  try {
    // Deactivate any existing sessions for this user
    await PersonalizedPracticePlan.updateMany(
      { userId, isActive: true },
      { isActive: false }
    );

    // Create new personalized session
    const session = new PersonalizedPracticePlan({
      userId,
      subject,
      syllabus,
      standard,
      Section1: questions.slice(0, Math.ceil(questions.length / 3)).map((q, i) => ({
        questionId: q._id,
        number: i + 1,
        status: "pending",
        attempts: 0,
      })),
      Section2: questions
        .slice(Math.ceil(questions.length / 3), Math.ceil(questions.length * 2 / 3))
        .map((q, i) => ({
          questionId: q._id,
          number: i + 1 + Math.ceil(questions.length / 3), // offset numbering
          status: "pending",
          attempts: 0,
        })),
      Section3: questions.slice(Math.ceil(questions.length * 2 / 3)).map((q, i) => ({
        questionId: q._id,
        number: i + 1 + Math.ceil(questions.length * 2 / 3), // offset numbering
        status: "pending",
        attempts: 0,
      })),
      currentQuestion: {
        section: 1,
        questionIndex: 0,
        questionId: questions[0]?._id || null,
      },
      progress: {
        completedQuestions: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        status: "not_started",
      },
      isActive: true,
      personalizedConfig: {
        examConfig,
        questionSources,
        createdAt: new Date(),
      },
    });

    await session.save();
    return session;
  } catch (error) {
    console.error("Error creating personalized session:", error);
    throw error;
  }
};

/**
 * Get personalized session details
 */
export const getPersonalizedSession = async (req, res) => {
  try {

    const {userId, syllabus , standard , subject} = req.body;

     const session = await PersonalizedPracticePlan.findOne({
      userId,
      syllabus,
      standard,
      subject,
    })
      .populate({
        path: 'Section1.questionId',
        select: 'question options correctAnswer difficulty topic subject'
      })
      .populate({
        path: 'Section2.questionId',
        select: 'question options correctAnswer difficulty topic subject'
      })
      .populate({
        path: 'Section3.questionId',
        select: 'question options correctAnswer difficulty topic subject'
      })
      .populate('currentQuestion.questionId', 'question options correctAnswer difficulty topic subject');

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Normalize options
    const normalizeOptions = (options) =>
      options.map((opt) => {
        if (typeof opt === "string") return { text: opt };
        if (opt && typeof opt === "object") {
          const plain = typeof opt.toObject === "function" ? opt.toObject() : opt;
          if (plain.text && String(plain.text).trim() !== "") return { text: String(plain.text).trim(), diagramUrl: plain.diagramUrl || null };
          if (plain.diagramUrl) return { text: "", diagramUrl: plain.diagramUrl };
          const joined = Object.keys(plain)
            .filter((k) => !isNaN(k))
            .sort((a, b) => a - b)
            .map((k) => String(plain[k] ?? "")).join("");
          if (joined.trim() !== "") return { text: joined };
          const fallback = Object.entries(plain)
            .filter(([key, value]) => !["_id", "id", "__v", "diagramUrl"].includes(key) && typeof value === "string")
            .map(([, value]) => value)
            .join(" ")
            .trim();
          return { text: fallback };
        }
        return { text: "" };
      });

    const mapSection = (section) =>
      section.map((q) => ({
        ...q.toObject(),
        question: q.questionId?.question,
        options: normalizeOptions(q.questionId?.options || []),
        correctAnswer: q.questionId?.correctAnswer,
        difficulty: q.questionId?.difficulty,
        topic: q.questionId?.topic
      }));

    res.status(200).json({
      message: "Personalized session retrieved successfully",
      session: {
        _id: session._id,
        subject: session.subject,
        Section1: mapSection(session.Section1),
        Section2: mapSection(session.Section2),
        Section3: mapSection(session.Section3),
        currentQuestion: {
          ...session.currentQuestion.toObject(),
          question: session.currentQuestion.questionId?.question,
          options: normalizeOptions(session.currentQuestion.questionId?.options || []),
          correctAnswer: session.currentQuestion.questionId?.correctAnswer,
          difficulty: session.currentQuestion.questionId?.difficulty,
          topic: session.currentQuestion.questionId?.topic
        },
        progress: session.progress,
        personalizedConfig: session.personalizedConfig
      }
    });
  } catch (error) {
    console.error("Error retrieving personalized session:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Get available topics for a subject
 */
export const getAvailableTopics = async (req, res) => {
  try {
    const { subject, syllabus, standard } = req.body;

    if (!subject) {
      return res.status(400).json({ message: "Subject is required" });
    }

    const topics = await twelve.distinct("topic", {
      subject,
      syllabus,
      Standard: standard
    });

    res.status(200).json({
      message: "Topics retrieved successfully",
      topics: topics.sort()
    });
  } catch (error) {
    console.error("Error retrieving topics:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



export const checkPersonalizedAnswerById = async (req, res) => {
  try {
    const { questionId } = req.params;
    const { userAnswer, userId } = req.body;

    if (!questionId || !userAnswer || !userId) {
      return res.status(400).json({
        message: "questionId, userAnswer, and userId are required",
      });
    }

    // 🔹 Fetch active session and populate sections + currentQuestion
    const session = await PersonalizedPracticePlan.findOne({
      userId,
      isActive: true,
    })
      .populate("Section1.questionId", "question correctAnswer options difficulty topic subject")
      .populate("Section2.questionId", "question correctAnswer options difficulty topic subject")
      .populate("Section3.questionId", "question correctAnswer options difficulty topic subject")
      .populate("currentQuestion.questionId", "question correctAnswer options difficulty topic subject");

    if (!session) {
      return res.status(404).json({ message: "Active personalized session not found" });
    }

    // 🔹 Helper: flatten all sections
    const allQuestions = [
      ...session.Section1.map((q) => ({ ...q.toObject(), section: 1 })),
      ...session.Section2.map((q) => ({ ...q.toObject(), section: 2 })),
      ...session.Section3.map((q) => ({ ...q.toObject(), section: 3 })),
    ];

    // 🔹 Find the question
    const target = allQuestions.find((q) => q.questionId?._id.toString() === questionId.toString());
    if (!target) {
      return res.status(404).json({ message: "Question not found in personalized session" });
    }

    const question = target.questionId;

    // 🔹 Check correctness
    const isCorrect =
      question.correctAnswer.trim().toLowerCase() === userAnswer.trim().toLowerCase();

    // 🔹 Update the session document in the correct section
    const sectionKey = `Section${target.section}`;
    const sectionIdx = session[sectionKey].findIndex(
      (q) => q.questionId._id.toString() === questionId.toString()
    );

    if (sectionIdx !== -1) {
      session[sectionKey][sectionIdx].status = isCorrect ? "correct" : "incorrect";
      session[sectionKey][sectionIdx].attempts += 1;
      session[sectionKey][sectionIdx].answeredAt = new Date();
      session[sectionKey][sectionIdx].userAnswer = userAnswer;
    }

    // 🔹 Update progress
    session.progress.completedQuestions += 1;
    if (isCorrect) session.progress.correctAnswers += 1;
    else session.progress.wrongAnswers += 1;

    // 🔹 Move current question pointer (very simple: just go next in same section, or move section)
    let { section, questionIndex } = session.currentQuestion;
    questionIndex++;

    if (section === 1 && questionIndex >= session.Section1.length) {
      section = 2;
      questionIndex = 0;
    }
    if (section === 2 && questionIndex >= session.Section2.length) {
      section = 3;
      questionIndex = 0;
    }

    if (section === 3 && questionIndex >= session.Section3.length) {
      // 🔹 Session completed
      session.progress.status = "completed";
      session.isActive = false;
      session.currentQuestion = { section: null, questionIndex: null, questionId: null };
    } else {
      session.progress.status = "in_progress";
      const nextQ = session[`Section${section}`][questionIndex];
      session.currentQuestion = {
        section,
        questionIndex,
        questionId: nextQ?.questionId || null,
      };
    }

    await session.save();

    return res.status(200).json({
      message: "Answer checked and personalized session updated",
      questionId: question._id,
      userAnswer,
      isCorrect,
      correctAnswer: isCorrect ? undefined : question.correctAnswer,
      progress: session.progress,
      currentQuestion: session.currentQuestion,
    });
  } catch (error) {
    console.error("Error in checkPersonalizedAnswerById:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};



/**
 * Get available previous year papers
 */
export const getAvailablePreviousYears = async (req, res) => {
  try {
    const { subject, syllabus = "CBSE", standard = "12" } = req.query;

    if (!subject) {
      return res.status(400).json({ message: "Subject is required" });
    }

    const years = await PreviousQuestionPaper.distinct("examYear", {
      subject,
      syllabus,
      standard
    });

    res.status(200).json({
      message: "Previous years retrieved successfully",
      years: years.sort((a, b) => b - a) // Sort descending (newest first)
    });
  } catch (error) {
    console.error("Error retrieving previous years:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Utility functions
const removeDuplicates = (questions) => {
  const seen = new Set();
  return questions.filter(q => {
    const id = q._id.toString();
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
};

const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};
