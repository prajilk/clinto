import PreviousQuestionPaper from "../Models/QuestionPaperModel.js";
import PreviousyearQuestions from "../Models/Previousyearquestion.js";

// Generate a previous-year session with 3 sections based on filters
export const generatePreviousYearSession = async (req, res) => {
  try {
    const {
      userId,
      subject,
      syllabus,
      standard,
      years = [],
      units = [],
      totalQuestions = 10,
      includeFrequentlyAsked,
      includeAttempted,
    } = req.body;

    if (!userId || !subject) {
      return res.status(400).json({ message: "userId and subject are required" });
    }

    // 🔎 Step 1: Check if ANY active session exists for this user/subject/syllabus/standard
    const activeSession = await PreviousyearQuestions.findOne({
      userId,
      subject,
      syllabus,
      standard,
      isActive: true,
    });

    if (activeSession) {
      return res.status(200).json({
        message: "Active session already exists",
        sessionId: activeSession._id,
        perSection: Math.max(1, Math.floor(totalQuestions / 3)),
        totalQuestions:
          activeSession.Section1.length +
          activeSession.Section2.length +
          activeSession.Section3.length,
        currentQuestion: activeSession.currentQuestion,
        preferences: activeSession.preferences,
      });
    }

    // 🔹 Step 2: If no active session, then create a new one
    const perSection = Math.max(1, Math.floor(totalQuestions / 3));
    const targetTotal = perSection * 3;

    const match = { subject, syllabus, standard };
    if (years?.length) match.examYear = { $in: years };
    if (units?.length) match.unit = { $in: units };

    const papers = await PreviousQuestionPaper.find(match)
      .select("questions examYear unit difficulty subject syllabus standard")
      .lean();

    let pool = [];
    papers.forEach((paper) => {
      let questions = paper.questions;
      if (includeFrequentlyAsked) {
        questions = questions.filter((q) => q.FrequentlyAsked === true);
      }
      questions.forEach((q, idx) => {
        pool.push({ paperId: paper._id, idx, q });
      });
    });

    if (includeAttempted) {
      const hist = await PreviousyearQuestions.find({ userId, subject })
        .select("Section1 Section2 Section3")
        .lean();
      const attemptedSet = new Set();
      hist.forEach((s) => {
        [...s.Section1, ...s.Section2, ...s.Section3].forEach((x) => {
          attemptedSet.add(`${x.questionId.toString()}_${x.paperQuestionIndex}`);
        });
      });
      pool = pool.filter(
        (p) => !attemptedSet.has(`${p.paperId.toString()}_${p.idx}`)
      );
    }

    if (pool.length === 0) {
      return res.status(404).json({ message: "No questions matched given filters" });
    }

    pool = shuffleArray(pool);

    const chosen = pool.slice(0, targetTotal);
    const s1 = chosen.slice(0, perSection);
    const s2 = chosen.slice(perSection, perSection * 2);
    const s3 = chosen.slice(perSection * 2, perSection * 3);

    const Section1 = s1.map((item, i) => ({
      questionId: item.paperId,
      paperQuestionIndex: item.idx,
      number: i + 1,
      status: "pending",
      attempts: 0,
    }));
    const Section2 = s2.map((item, i) => ({
      questionId: item.paperId,
      paperQuestionIndex: item.idx,
      number: i + 1,
      status: "pending",
      attempts: 0,
    }));
    const Section3 = s3.map((item, i) => ({
      questionId: item.paperId,
      paperQuestionIndex: item.idx,
      number: i + 1,
      status: "pending",
      attempts: 0,
    }));

    const currentQuestion = {
      section: 1,
      questionIndex: 0,
      questionId: Section1[0]?.questionId || null,
    };

    const session = new PreviousyearQuestions({
      userId,
      subject,
      syllabus,
      standard,
      Section1,
      Section2,
      Section3,
      currentQuestion,
      progress: {
        completedQuestions: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        status: "not_started",
      },
      preferences: {
        years,
        units,
        includeFrequentlyAsked: !!includeFrequentlyAsked,
        includeAttempted: !!includeAttempted,
        totalQuestions,
      },
      isActive: true,
    });

    await session.save();

    return res.status(201).json({
      message: "Previous year session created",
      sessionId: session._id,
      perSection,
      totalQuestions: targetTotal,
      currentQuestion,
    });
  } catch (error) {
    console.error("Error generating PYQ session:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



// Get a fully populated session (with actual question texts/options)
export const getPreviousYearSession = async (req, res) => {
    try {
       
        const { userId, subject, syllabus, standard } = req.body;

        if (!userId) {
            return res.status(400).json({ message: "userId is required" });
        }
        if (!subject || !syllabus || !standard) {
            return res.status(400).json({ message: "userId, subject, syllabus and standard are required" });
        }
        const session = await PreviousyearQuestions.findOne({ userId, isActive: true })
            .lean();
        if (!session) return res.status(404).json({ message: "No active session found" });

        // collect paper ids
        const paperIds = [
            ...session.Section1.map((x) => x.questionId),
            ...session.Section2.map((x) => x.questionId),
            ...session.Section3.map((x) => x.questionId),
        ];
        const unique = [...new Set(paperIds.map((id) => id.toString()))];
        const papers = await PreviousQuestionPaper.find({ _id: { $in: unique } }).lean();

        const indexById = new Map(papers.map((p) => [p._id.toString(), p]));

        const mapSection = (arr) =>
            arr.map((x) => {
                const paper = indexById.get(x.questionId.toString());
                const pq = paper?.questions?.[x.paperQuestionIndex];
                return {
                    ...x,
                    question: pq?.question,
                    options: pq?.options || [],
                    correctAnswer: pq?.correctAnswer,
                };
            });

        return res.status(200).json({
            message: "Session retrieved",
            Section1: mapSection(session.Section1),
            Section2: mapSection(session.Section2),
            Section3: mapSection(session.Section3),
            currentQuestion: session.currentQuestion,
            progress: session.progress,
        });
    } catch (error) {
        console.error("Error getting PYQ session:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Check answer by pointing to paper + index
export const checkPreviousYearAnswer = async (req, res) => {
  try {
    const { questionId } = req.params; // this is the Question _id inside PreviousQuestionPaper.questions
    const { userId, userAnswer } = req.body;

    if (!userId || !questionId || !userAnswer) {
      return res.status(400).json({
        message: "userId, questionId, and userAnswer are required",
      });
    }

    // 🔹 Find active PYQ session
    const session = await PreviousyearQuestions.findOne({ userId, isActive: true })
      .populate("Section1.questionId", "questions correctAnswer subject")
      .populate("Section2.questionId", "questions correctAnswer subject")
      .populate("Section3.questionId", "questions correctAnswer subject")
      .populate("currentQuestion.questionId", "questions correctAnswer subject");

    if (!session) {
      return res.status(404).json({ message: "Active session not found" });
    }

    // 🔹 Flatten all sections with section info
    const allQuestions = [
      ...session.Section1.map((q) => ({ ...q.toObject(), section: 1 })),
      ...session.Section2.map((q) => ({ ...q.toObject(), section: 2 })),
      ...session.Section3.map((q) => ({ ...q.toObject(), section: 3 })),
    ];

    // 🔹 Find the target question inside the session
    const target = allQuestions.find(
      (q) =>
        q.questionId?._id.toString() === questionId.toString() ||
        q.questionId?.toString() === questionId.toString()
    );

    if (!target) {
      return res.status(404).json({ message: "Question not found in session" });
    }

    const paperDoc = target.questionId; // populated PreviousQuestionPaper
    const pq = paperDoc.questions?.[target.paperQuestionIndex];
    if (!pq) {
      return res.status(404).json({ message: "Question not found in paper data" });
    }

    // 🔹 Check correctness
    const isCorrect =
      pq.correctAnswer.trim().toLowerCase() === userAnswer.trim().toLowerCase();

    // 🔹 Update session
    const sectionKey = `Section${target.section}`;
    const sectionIdx = session[sectionKey].findIndex(
      (q) =>
        q.questionId._id.toString() === paperDoc._id.toString() &&
        q.paperQuestionIndex === target.paperQuestionIndex
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

    // 🔹 Move pointer
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
      // completed
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
      message: "Answer checked",
      questionId: pq._id,
      userAnswer,
      isCorrect,
      correctAnswer: isCorrect ? undefined : pq.correctAnswer,
      progress: session.progress,
      currentQuestion: session.currentQuestion,
    });
  } catch (error) {
    console.error("Error checking PYQ answer:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}



export const GetAllUnits = async (req, res) => {
    try {
        const { subject, syllabus, standard } = req.body;
        if (!subject || !syllabus || !standard) {
            return res.status(400).json({ message: "subject, syllabus and standard are required" });
        }
        const units = await PreviousQuestionPaper.distinct("unit", { subject, syllabus, standard });
        res.status(200).json({ message: "Units fetched successfully", units });
    } catch (error) {
        console.error("Error retrieving topics:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
}