import express from "express";
import dotenv from 'dotenv';
import ConnectDB from "./Database/db.js";
import CourseRoute from "./Route/CourseRoute.js";
import McqRoute from "./Route/McqRoute.js";
import PracticeplanRoute from "./Route/PracticeplanRoute.js";
import StudentRoute from "./Route/StudentRoute.js"
import AdminRoute from "./Route/AdminRoute.js"
import QuestionPaperRoute from "./Route/QuestionPaperRoute.js"
import PersonalizedMcqRoute from "./Route/PersonalizedMcqRoute.js"
import PaymentRoute from "./Route/PaymentRoute.js"
import TodaysQuestionRoute from "./Route/TodaysQuestionRoute.js"
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./Database/db.js";

await connectDB();

const app = express();

dotenv.config();
app.use(cors({
    origin: "*", // Allow all origins
    credentials: true, // Not compatible with "*" (see note below)
}));


const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.send('Hello World!');
})

app.use('/api/course', CourseRoute);
app.use('/api/mcq', McqRoute);
app.use('/api/practiceplan', PracticeplanRoute);
app.use('/api/student', StudentRoute);
app.use('/api/admin', AdminRoute);
app.use('/api/questionpaper', QuestionPaperRoute);
app.use('/api/personalizedmcq', PersonalizedMcqRoute);
app.use('/api/payment', PaymentRoute)
app.use('/api/todaysquestion', TodaysQuestionRoute);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


