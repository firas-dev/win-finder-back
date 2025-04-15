import  express  from "express";
import "dotenv/config";
import authRoutes from "./routes/authRoutes.js";
import postRoute from "./routes/postRoute.js";
import {connectDB} from "./lib/db.js";
import cors from "cors";
import job from "./lib/cron.js"
const app = express(); 
const PORT=process.env.PORT||3000 ; 
job.start(); 
app.use(express.json()); 
app.use(cors()); 
app.use("/api/auth",authRoutes)
app.use("/api/objects",postRoute)


app.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`); 
    connectDB(); 
}); 