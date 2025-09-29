import jwt from 'jsonwebtoken'
import Student from '../Models/StudentModel.js'

export const protectRoute = async(req, res, next) => {
    try {
          let token = req.cookies.jwt;
          console.log('token',token);     
        if (!token) {
            return res.status(401).json({ error: "Unauthorized - No Token Provided" });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);   
        if (!decoded) {
            return res.status(401).json({ error: "Unauthorized - Invalid Token Provided" });
        }

        let user = await Student.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        req.user = user;
        req.userId = decoded.id
        next();

    } catch (error) {
        console.log(error.message);
        res.status(500).json({ error: "Internal server error" });
    }
}