import twelve from "../Models/McqModel.js";
import PracticePlan from "../Models/PraticePlanModel.js";
import RandomQuestions from '../Models/RandomquestionsModel.js'
import MissedQuestions from '../Models/MissedquestionsModel.js'
import FlaggedQuestion from '../Models/FlaggedquestionsModel.js'
import MockQuestions from '../Models/MockQuestionModel.js'
import PreviousyearQuestions from '../Models/Previousyearquestion.js'


export const createPraticePlan = async (req, res) => {

  try {
    const {
      userId,
      standard,
      syllabus,
      subject,
      totalQuestions,
      preferredTime,
      startDate,
      difficulty,
      endDate,
      skipdays,
    } = req.body;

    console.log("Received practice plan data:", req.body);

    if (
      !standard ||
      !syllabus ||
      !subject ||
      !totalQuestions ||
      !preferredTime ||
      !startDate ||
      !endDate ||
      !difficulty ||
      !skipdays
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const questionCount = parseInt(totalQuestions) || 5;

    const totalNeeded = questionCount * 3;

    // Fetch total unique questions
    const matchedQuestions = await twelve.aggregate([
      {
        $match: {
          Standard: standard,
          syllabus: syllabus,
          subject: subject,
          difficulty: difficulty,

        },
      },
      { $sample: { size: totalNeeded } }, // fetch all at once
      {
        $project: {
          _id: 1,
          question: 1,
          options: 1,
          correctAnswer: 1,
        },
      },
    ]);


    if (matchedQuestions.length < totalNeeded) {
      return res.status(404).json({
        message: `Not enough questions found. Required ${totalNeeded}, found ${matchedQuestions.length}`,
      });
    }

    // Split into 3 sections
    const section1Questions = matchedQuestions.slice(0, questionCount).map((q, i) => ({
      questionId: q._id,
      number: i + 1,
    }));

    const section2Questions = matchedQuestions.slice(questionCount, questionCount * 2).map((q, i) => ({
      questionId: q._id,
      number: i + 1,
    }));

    const section3Questions = matchedQuestions.slice(questionCount * 2, questionCount * 3).map((q, i) => ({
      questionId: q._id,
      number: i + 1,
    }));


    // Create new practice plan
    const newPlan = new PracticePlan({
      userId,
      preferences: {
        standard,
        syllabus,
        subject,
        totalQuestions: totalNeeded,
        preferredTime,
        startDate,
        endDate,
        difficulty,
        skipdays
      },
      Section1: section1Questions,
      Section2: section2Questions,
      Section3: section3Questions,
    });

    await newPlan.save();

    return res.status(201).json({
      message: "Practice plan created successfully",
      plan: newPlan,
      planid: newPlan._id,
    });
  } catch (error) {
    console.error("Error creating practice plan: ", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

export const getPracticePlanQuestions = async (req, res) => {
  try {
    const { planId } = req.params;

    if (!planId) {
      return res.status(400).json({ message: "Plan ID is required" });
    }

    // Fetch practice plan with populated question data
    const plan = await PracticePlan.findById(planId)
      .populate({
        path: 'Section1.questionId',
        select: 'question options correctAnswer difficulty subject topic'
      })
      .populate({
        path: 'Section2.questionId',
        select: 'question options correctAnswer difficulty subject topic'
      })
      .populate({
        path: 'Section3.questionId',
        select: 'question options correctAnswer difficulty subject topic'
      })
      .populate('currentQuestion.questionId', 'question options correctAnswer');

    if (!plan) {
      return res.status(404).json({ message: "Practice plan not found" });
    }

    res.status(200).json({
      message: "Practice plan retrieved successfully",
      plan: plan
    });
  } catch (error) {
    console.error("Error retrieving practice plan:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getQuestionBySectionAndIndex = async (req, res) => {
  try {
    const { planId, section, questionIndex } = req.params;

    if (!planId || !section || questionIndex === undefined) {
      return res.status(400).json({ message: "Plan ID, section, and question index are required" });
    }

    const plan = await PracticePlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: "Practice plan not found" });
    }

    const sectionKey = `Section${section}`;
    const sectionQuestions = plan[sectionKey];

    if (!sectionQuestions?.[questionIndex]) {
      return res.status(400).json({ message: "Invalid section or question index" });
    }

    const currentQ = sectionQuestions[questionIndex];

    // Populate the question data
    const questionData = await twelve.findById(currentQ.questionId)
      .select('question options correctAnswer difficulty subject topic');

    if (!questionData) {
      return res.status(404).json({ message: "Question not found" });
    }

    res.status(200).json({
      message: "Question retrieved successfully",
      question: {
        ...questionData.toObject(),
        status: currentQ.status,
        answeredAt: currentQ.answeredAt,
        attempts: currentQ.attempts,
        number: currentQ.number
      }
    });
  } catch (error) {
    console.error("Error retrieving question:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const checkAnswerById = async (req, res) => {
  try {
    const questionId = req.params.id;
    const { userAnswer, userId } = req.body;

    if (!questionId || !userAnswer || !userId) {
      return res.status(400).json({
        message: "questionId, userAnswer and userId are required",
      });
    }

    // Fetch question
    const question = await twelve.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    // Compare answers
    const isCorrect =
      question.correctAnswer.trim().toLowerCase() ===
      userAnswer.trim().toLowerCase();

    // ✅ Find active session
    const session = await RandomQuestions.findOne({ userId, isActive: true });
    if (!session) {
      return res.status(404).json({ message: "Active session not found" });
    }

    // ✅ Locate question in session (in any section)
    const updateQuestionStatus = (section) => {
      const idx = section.findIndex(
        (q) => q.questionId.toString() === questionId.toString()
      );
      if (idx !== -1) {
        section[idx].status = isCorrect ? "correct" : "incorrect";
        section[idx].attempts += 1;
        section[idx].answeredAt = new Date();
        return idx;
      }
      return -1;
    };

    let updatedIndex = updateQuestionStatus(session.Section1);
    let sectionNumber = 1;

    if (updatedIndex === -1) {
      updatedIndex = updateQuestionStatus(session.Section2);
      sectionNumber = 2;
    }
    if (updatedIndex === -1) {
      updatedIndex = updateQuestionStatus(session.Section3);
      sectionNumber = 3;
    }

    if (updatedIndex === -1) {
      return res.status(404).json({
        message: "Question not found in user session",
      });
    }

    // ✅ Update progress
    session.progress.completedQuestions += 1;
    if (isCorrect) session.progress.correctAnswers += 1;
    else session.progress.wrongAnswers += 1;

    // ✅ Move currentQuestion to the next one
    let nextSection = sectionNumber;
    let nextIndex = updatedIndex + 1;

    if (nextSection === 1 && nextIndex >= session.Section1.length) {
      nextSection = 2;
      nextIndex = 0;
    }
    if (nextSection === 2 && nextIndex >= session.Section2.length) {
      nextSection = 3;
      nextIndex = 0;
    }
    if (nextSection === 3 && nextIndex >= session.Section3.length) {
      // ✅ All completed
      session.progress.status = "completed";
      session.isActive = false;
    } else {
      session.progress.status = "in_progress";
    }

    // ✅ Save currentQuestion pointer
    session.currentQuestion = {
      section: nextSection,
      questionIndex: nextIndex,
      questionId:
        nextSection === 1
          ? session.Section1[nextIndex]?._id
          : nextSection === 2
            ? session.Section2[nextIndex]?._id
            : session.Section3[nextIndex]?._id,
    };

    await session.save();

    return res.status(200).json({
      message: "Answer checked and session updated",
      questionId: question._id,
      userAnswer,
      isCorrect,
      correctAnswer: isCorrect ? undefined : question.correctAnswer,
      progress: session.progress,
      currentQuestion: session.currentQuestion,
    });
  } catch (error) {
    console.error("Error checking answer by id:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};




// ✅ getRandomQuestion
export const getRandomQuestion = async (req, res) => {
  try {
    const { userId, subject, syllabus, standard } = req.body;

    console.log("Request body:", req.body);

    console.log("userId:", userId, "subject:", subject, "syllabus", syllabus, "standard", standard);



    // === VALIDATION ===
    if (!userId || !subject || !syllabus || !standard) {
      return res.status(400).json({
        message: "userId, subject, syllabus and standard are required",
      });
    }

    const questionCount = 10;
    const totalNeeded = questionCount * 3;

    // === 1) Resume existing active session if present ===
    const existingSession = await RandomQuestions.findOne({
      userId,
      subject,
      syllabus,
      standard,
      isActive: true,
    });
    console.log("datastoring", existingSession);

    if (existingSession) {
      // collect all question IDs from the session
      const allIds = [
        ...existingSession.Section1.map((q) => q.questionId),
        ...existingSession.Section2.map((q) => q.questionId),
        ...existingSession.Section3.map((q) => q.questionId),
      ];


      console.log("datastoring", existingSession);

      // fetch question details once and map by id (lean for plain objects)
      const fullQuestions = await twelve
        .find({ _id: { $in: allIds } })
        .select("_id question options correctAnswer")
        .lean();

      const fqMap = new Map(fullQuestions.map((fq) => [fq._id.toString(), fq]));

      const mapWithDetails = (section) =>
        section.map((q) => {
          // q might be a mongoose subdoc -> convert safely
          const plain = q.toObject ? q.toObject() : { ...q };
          const details = fqMap.get((plain.questionId || "").toString());
          return {
            ...plain,
            question: details?.question ?? null,
            options: details?.options ?? null,
            correctAnswer: details?.correctAnswer ?? null,
          };
        });

      let current = null;
      if (existingSession.currentQuestion) {
        const { section, questionIndex } = existingSession.currentQuestion;
        const arr =
          section === 1
            ? existingSession.Section1
            : section === 2
              ? existingSession.Section2
              : existingSession.Section3;
        current = arr && arr[questionIndex] ? (arr[questionIndex].toObject ? arr[questionIndex].toObject() : arr[questionIndex]) : null;
        if (current) {
          const d = fqMap.get(current.questionId.toString());
          current.question = d?.question ?? null;
          current.options = d?.options ?? null;
          current.correctAnswer = d?.correctAnswer ?? null;
        }
      }

      return res.status(200).json({
        message: "Resuming previous session",
        existingSessionId: existingSession._id,
        subject,
        syllabus,
        standard,
        Section1: mapWithDetails(existingSession.Section1),
        Section2: mapWithDetails(existingSession.Section2),
        Section3: mapWithDetails(existingSession.Section3),
        currentQuestion: current,
        progress: existingSession.progress,
      });
    }

    // === 2) No existing session: ensure DB has enough questions for the requested triple ===
    const availableCount = await twelve.countDocuments({
      subject,
      syllabus,
      standard,
    });

    if (availableCount === 0) {
      return res.status(404).json({ message: "No questions found for this subject/syllabus/standard." });
    }

    if (availableCount < totalNeeded) {
      return res.status(400).json({
        message: `Not enough questions available. Found ${availableCount}, need ${totalNeeded}.`,
      });
    }

    // === fetch random questions (we know DB has at least totalNeeded) ===
    const randomQuestions = await twelve.aggregate([
      { $match: { subject, syllabus, standard } },
      { $sample: { size: totalNeeded } },
    ]);

    // build section arrays (store minimal data in DB: ids + metadata)
    const Section1 = randomQuestions.slice(0, questionCount).map((q, i) => ({
      questionId: q._id,
      number: i + 1,
      status: "pending",
      attempts: 0,
    }));

    const Section2 = randomQuestions.slice(questionCount, questionCount * 2).map((q, i) => ({
      questionId: q._id,
      number: i + 1,
      status: "pending",
      attempts: 0,
    }));

    const Section3 = randomQuestions.slice(questionCount * 2).map((q, i) => ({
      questionId: q._id,
      number: i + 1,
      status: "pending",
      attempts: 0,
    }));

    const newSession = new RandomQuestions({
      userId,
      subject,
      syllabus,
      standard,
      Section1,
      Section2,
      Section3,
      currentQuestion: { section: 1, questionIndex: 0, questionId: Section1[0].questionId },
      isActive: true,
      progress: {
        completedQuestions: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        status: "not_started",
      },
    });

    await newSession.save();

    // populate question details for response (so client gets full questions)
    const allIds = [...Section1, ...Section2, ...Section3].map((s) => s.questionId);
    const fullQuestions = await twelve
      .find({ _id: { $in: allIds } })
      .select("_id question options correctAnswer")
      .lean();

    const fqMap = new Map(fullQuestions.map((fq) => [fq._id.toString(), fq]));

    const mapWithDetails = (section) =>
      section.map((s) => ({
        ...s,
        question: fqMap.get(s.questionId.toString())?.question ?? null,
        options: fqMap.get(s.questionId.toString())?.options ?? null,
        correctAnswer: fqMap.get(s.questionId.toString())?.correctAnswer ?? null,
      }));

    return res.status(201).json({
      message: "New session started",
      subject,
      syllabus,
      standard,
      Section1: mapWithDetails(Section1),
      Section2: mapWithDetails(Section2),
      Section3: mapWithDetails(Section3),
      currentQuestion: mapWithDetails([Section1[0]])[0],
      progress: newSession.progress,
    });
  } catch (error) {
    console.error("Error fetching question:", error);
    return res.status(500).json({ message: "Error fetching question", error: error.message });
  }
};



export const createMissedQuestions = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: "Request body is missing" });
    }
    const { userId, subject, syllabus, standard } = req.body;

    if (!userId || !subject || !syllabus || !standard) {
      return res.status(400).json({ message: "User ID, subject, syllabus, and standard are required" });
    }

    // ✅ Gather incorrect questions across all sources (active or completed)
    const collected = [];

    const pushIncorrect = (arr, onlyActive = true) => {
      if (!Array.isArray(arr)) return;
      for (let q of arr) {
        if (q && q.status === "incorrect") {
          collected.push({
            questionId: q.questionId,
            index: typeof q.index === "number" ? q.index : (typeof q.number === "number" ? q.number : null),
            status: q.status,
            answeredAt: q.answeredAt || null,
            attempts: q.attempts || 0,
          });
        }
      }
    };

    // RandomQuestions: fields match subject/syllabus/standard
    const randomSessions = await RandomQuestions.find({
      userId,
      subject,
      syllabus,
      standard,
      isActive: true
    }).lean();

     console.log("randomSessions", randomSessions);
     
    for (const s of randomSessions) {
      pushIncorrect(s.Section1);
      pushIncorrect(s.Section2);
      pushIncorrect(s.Section3);
    }
    // MockQuestions: note Standard (capital S)
    const mockSessions = await MockQuestions.find({ userId, subject, syllabus, Standard: standard }).lean();
    for (const s of mockSessions) pushIncorrect(s.questions);

    console.log("mockSessions", mockSessions);
    

    // FlaggedQuestion: no subject on session; collect all and filter later by question doc
    const flaggedSessions = await FlaggedQuestion.find({ userId }).lean();
    for (const s of flaggedSessions) pushIncorrect(s.questions);

    // PreviousyearQuestions: subject likely present
    const previousYearSessions = await PreviousyearQuestions.find({ userId, subject }).lean();
    for (const s of previousYearSessions) pushIncorrect(s.questions);

    // PracticePlan: preferences carry subject/syllabus/standard
    const practicePlans = await PracticePlan.find({
      userId,
      "preferences.subject": subject,
      "preferences.syllabus": syllabus,
      "preferences.standard": standard,
    }).lean();
    for (const p of practicePlans) {
      pushIncorrect(p.Section1);
      pushIncorrect(p.Section2);
      pushIncorrect(p.Section3);
    }

    if (collected.length === 0) {
      return res.status(200).json({ message: "No missed questions found" });
    }

    // ✅ Filter by actual question metadata in master (ensures correct subject/syllabus/standard)
    const ids = Array.from(new Set(collected.map((x) => String(x.questionId)).filter(Boolean)));
    let eligible = new Set();
    if (ids.length > 0) {
      const eligibleDocs = await twelve
        .find({ _id: { $in: ids }, subject, syllabus, Standard: String(standard)  })
        .select("_id")
        .lean();
      eligible = new Set(eligibleDocs.map((d) => String(d._id)));
    }

    const filtered = collected.filter((x) => eligible.has(String(x.questionId)));
    if (filtered.length === 0) {
      return res.status(200).json({ message: "No missed questions found" });
    }

    // ✅ De-duplicate by questionId, keep earliest occurrence
    const uniqMap = new Map();
    for (const item of filtered) {
      const key = String(item.questionId);
      if (!uniqMap.has(key)) uniqMap.set(key, item);
    }
    const uniqueIncorrects = Array.from(uniqMap.values());

    // ✅ Upsert into MissedQuestions
    const missedSession = await MissedQuestions.findOneAndUpdate(
      { userId, subject, syllabus, standard, isActive: true },
      {
        userId,
        subject,
        syllabus,
        standard,
        questions: uniqueIncorrects,
        currentQuestion: {
          index: 0,
          questionId: uniqueIncorrects[0].questionId,
        },
        progress: {
          completedQuestions: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          status: "in_progress",
        },
        isActive: true,
      },
      { upsert: true, new: true }
    );

    return res.status(201).json({
      message: "Missed questions session created successfully",
      subject,
      syllabus,
      standard,
      totalMissed: uniqueIncorrects.length,
      sessionId: missedSession._id,
    });
  } catch (error) {
    console.error("Error creating missed questions:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getMissedQuestions = async (req, res) => {
  try {
    
    const { userId , subject, syllabus, standard } = req.body;

    if (!subject) {
      return res.status(400).json({ message: "Subject is required" });
    }

    // Find the session for this user and subject that is active
    const session = await MissedQuestions.findOne({ userId, subject, syllabus, standard, isActive: true });

    if (!session) {
      return res.status(404).json({ message: "No missed questions session found for this subject" });
    }

    const normalizeOptions = (options) =>
      options.map((opt) => {
        if (typeof opt === "string") return { text: opt };
        if (opt && typeof opt === "object") {
          if (opt.text && String(opt.text).trim() !== "") return { text: String(opt.text).trim() };
          if (opt.diagramUrl && String(opt.diagramUrl).trim() !== "") return { diagramUrl: String(opt.diagramUrl).trim() };
          // Fallback: concatenate any string-like values (handles shapes like {A:".."})
          const stringValues = Object.entries(opt)
            .filter(([key, value]) =>
              !["_id", "id", "__v"].includes(key) && typeof value === "string" && value.trim() !== ""
            )
            .map(([, value]) => value.trim());
          if (stringValues.length > 0) {
            return { text: stringValues.join(" ") };
          }
          // Fallback: numeric-key join (e.g., {0:"a",1:"b"})
          const joined = Object.keys(opt)
            .filter((k) => !isNaN(k))
            .sort((a, b) => a - b)
            .map((k) => String(opt[k]).trim())
            .filter((v) => v !== "")
            .join(" ");
          if (joined) return { text: joined };
        }
        return { text: "" };
      });

    // Load full question docs for all missed question IDs
    const allIds = session.questions.map((q) => q.questionId);
    const fullQuestions = await twelve
      .find({ _id: { $in: allIds } })
      .select("_id question options correctAnswer");

    const getById = (id) => fullQuestions.find((fq) => fq._id.toString() === String(id));

    const mapQuestions = (questionsArray) =>
      questionsArray.map((q) => {
        const details = getById(q.questionId);
        return {
          index: q.index,
          status: q.status,
          answeredAt: q.answeredAt,
          attempts: q.attempts,
          question: details?.question || "",
          options: normalizeOptions(details?.options || []),
          correctAnswer: details?.correctAnswer || "",
        };
      });

    // Resolve currentQuestion
    let currentQuestion = null;
    if (session.currentQuestion?.questionId) {
      const cur = getById(session.currentQuestion.questionId);
      currentQuestion = cur
        ? {
          index: session.currentQuestion.index,
          question: cur.question,
          options: normalizeOptions(cur.options || []),
          correctAnswer: cur.correctAnswer,
        }
        : null;
    }

    res.status(200).json({
      message: "Missed questions retrieved",
      subject: session.subject,
      questions: mapQuestions(session.questions),
      currentQuestion,
      progress: session.progress,
    });

  } catch (error) {
    console.error("Error fetching missed questions:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const checkMissedAnswer = async (req, res) => {
  try {
    const questionId = req.params.id;
    const { userAnswer, userId } = req.body;

    if (!questionId || !userAnswer || !userId) {
      return res.status(400).json({
        message: "questionId, userAnswer and userId are required",
      });
    }

    // Fetch question
    const question = await twelve.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    const isCorrect =
      question.correctAnswer.trim().toLowerCase() ===
      userAnswer.trim().toLowerCase();

    // Find active missed questions session
    const session = await MissedQuestions.findOne({ userId, isActive: true });
    if (!session) {
      return res.status(404).json({ message: "Active missed questions session not found" });
    }

    // Find and update the question
    const index = session.questions.findIndex(
      (q) => q.questionId.toString() === questionId.toString()
    );

    if (index === -1) {
      return res.status(404).json({
        message: "Question not found in missed questions session",
      });
    }

    session.questions[index].attempts += 1;
    session.questions[index].answeredAt = new Date();
    session.questions[index].status = isCorrect ? "correct" : "incorrect";

    // Update progress
    session.progress.completedQuestions += 1;
    if (isCorrect) {
      session.progress.correctAnswers += 1;
    } else {
      session.progress.wrongAnswers += 1;
    }

    // Update status if all questions answered
    const allAnswered = session.questions.every((q) => q.answeredAt);
    if (allAnswered) {
      session.progress.status = "completed";
      session.isActive = false;
    } else {
      session.progress.status = "in_progress";
    }

    // Move currentQuestion if not completed
    if (!allAnswered) {
      const nextQuestion = session.questions.find((q) => !q.answeredAt);
      if (nextQuestion) {
        session.currentQuestion = {
          index: nextQuestion.index,
          questionId: nextQuestion.questionId,
        };
      }
    }

    await session.save();

    res.status(200).json({
      message: "Answer checked and session updated",
      questionId: question._id,
      userAnswer,
      isCorrect,
      correctAnswer: isCorrect ? undefined : question.correctAnswer,
      progress: session.progress,
      currentQuestion: session.currentQuestion,
    });
  } catch (error) {
    console.error("Error checking missed answer:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const createRandomQuestions = async (req, res) => {
  try {
    const { userId, subject, syllabus, standard } = req.body;

    if (!userId || !subject) {
      return res.status(400).json({ message: "User ID and subject are required" });
    }

    // ✅ Check if there's an active session for the same subject
    const existingActiveSession = await RandomQuestions.findOne({
      userId,
      subject,
      syllabus,
      standard,
      isActive: true,
    });

    if (existingActiveSession) {
      return res.status(201).json({
        message: "An active session already exists for this subject. Please complete it before starting a new one.",
        sessionId: existingActiveSession._id,
      });
    }

    // ✅ Check if there's an active session for other subjects, allow creating new one
    // No need to block if it's another subject

    const questionCount = 10; // 🔹 5 from each section
    const totalNeeded = questionCount * 3;

    // Fetch random questions for subject
    const randomQuestions = await twelve.aggregate([
      { $match: { subject } },
      { $sample: { size: totalNeeded } },
      {
        $project: {
          _id: 1,
          question: 1,
          options: 1,
          correctAnswer: 1,
          difficulty: 1,
          topic: 1,
        },
      },
    ]);

    if (randomQuestions.length < totalNeeded) {
      return res.status(404).json({
        message: `Not enough questions found. Required ${totalNeeded}, found ${randomQuestions.length}`,
      });
    }

    // Divide into 3 sections
    const section1 = randomQuestions.slice(0, questionCount).map((q, i) => ({
      questionId: q._id,
      number: i + 1,
    }));

    const section2 = randomQuestions.slice(questionCount, questionCount * 2).map((q, i) => ({
      questionId: q._id,
      number: i + 1,
    }));

    const section3 = randomQuestions.slice(questionCount * 2).map((q, i) => ({
      questionId: q._id,
      number: i + 1,
    }));

    // Save new session
    const newSession = new RandomQuestions({
      userId,
      subject,
      syllabus,
      standard,
      Section1: section1,
      Section2: section2,
      Section3: section3,
      currentQuestion: {
        section: 1,
        questionIndex: 0,
        questionId: section1[0].questionId,
      },
      isActive: true,
      progress: { status: "in_progress" },
    });

    await newSession.save();

    return res.status(200).json({
      message: "Random question session created successfully",
      sessionId: newSession,
    });
  } catch (error) {
    console.error("Error creating random questions:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const GetRandomQuestions = async (req, res) => {
  try {
    const { userId } = req.params;

    const session = await RandomQuestions.findOne({ userId, isActive: true })
      .populate({
        path: "Section1.questionId",
        select: "question options correctAnswer",
      })
      .populate({
        path: "Section2.questionId",
        select: "question options correctAnswer",
      })
      .populate({
        path: "Section3.questionId",
        select: "question options correctAnswer",
      })
      .populate("currentQuestion.questionId", "question options correctAnswer");

    if (!session) {
      return res.status(404).json({ message: "No active session found" });
    }

    // 🔹 Normalize options before sending
    const normalizeOptions = (options) =>
      options.map((opt) => {
        if (typeof opt === "string") return { text: opt };
        if (opt && typeof opt === "object") {
          if (opt.text) return opt;
          if (opt.diagramUrl) return opt;
          const joined = Object.keys(opt)
            .filter((k) => !isNaN(k))
            .sort((a, b) => a - b)
            .map((k) => opt[k])
            .join("");
          return { text: joined };
        }
        return { text: "" };
      });

    const mapSection = (section) =>
      section.map((q) => ({
        ...q.toObject(),
        question: q.questionId?.question,
        options: normalizeOptions(q.questionId?.options || []),
        correctAnswer: q.questionId?.correctAnswer,
      }));

    res.status(200).json({
      message: "Session retrieved",
      subject: session.subject,
      Section1: mapSection(session.Section1),
      Section2: mapSection(session.Section2),
      Section3: mapSection(session.Section3),
      currentQuestion: {
        ...session.currentQuestion.toObject(),
        question: session.currentQuestion.questionId?.question,
        options: normalizeOptions(session.currentQuestion.questionId?.options || []),
        correctAnswer: session.currentQuestion.questionId?.correctAnswer,
      },
      progress: session.progress,
    });
  } catch (error) {
    console.error("Error in getRandomSession:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};




