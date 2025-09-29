import PreviousQuestionPaper from "../Models/QuestionPaperModel.js"


export const addPreviousQuestionPaper = async (req, res) => {
    try {
        const {
            examYear,
            examType,
            subject,
            syllabus,
            standard,
            paperName,
            sourceType,
            questions,
            notes,
            unit
        } = req.body;

        if (!examYear || !examType || !subject || !syllabus || !standard || !paperName || !questions || !unit) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const questionsArray = Array.isArray(questions) ? questions : [questions];

        const newPaper = new PreviousQuestionPaper({
            examYear,
            examType,
            subject,
            syllabus,
            standard,
            paperName,
            sourceType: sourceType || "Manual",
            questions: questionsArray,
            notes: notes || null,
            unit
        });

        await newPaper.save();
        return res.status(201).json({
            message: "Previous question paper added successfully",
            paper: newPaper
        });
    } catch (error) {
        console.error("Error adding previous question paper:", error);
        return res.status(500).json({ message: "Server error", error });
    }
};


