import express from "express";
import Message from "../models/Message.js";
import mongoose from "mongoose";
import protectRoute from "../middleware/auth.middleware.js";

const router = express.Router();


const validateObjectId = (id) => mongoose.Types.ObjectId.isValid(id);


router.get("/:userId1/:userId2", protectRoute, async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;
    const { page = 1, limit = 20 } = req.query; 


    if (!validateObjectId(userId1) || !validateObjectId(userId2)) {
      return res.status(400).json({ error: "Invalid user IDs" });
    }

    if (req.user._id.toString() !== userId1 && req.user._id.toString() !== userId2) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    const messages = await Message.find({
      $or: [
        { sender: userId1, receiver: userId2 },
        { sender: userId2, receiver: userId1 },
      ],
    })
      .sort({ timestamp: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean(); 

    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


router.post("/", protectRoute, async (req, res) => {
  try {
    const { sender, receiver, content } = req.body;

    
    if (!sender || !receiver || !content || content.trim() === "") {
      return res.status(400).json({ error: "Missing or invalid required fields" });
    }
    if (!validateObjectId(sender) || !validateObjectId(receiver)) {
      return res.status(400).json({ error: "Invalid sender or receiver ID" });
    }
    if (content.length > 1000) {
      
      return res.status(400).json({ error: "Message content too long" });
    }


    if (req.user._id.toString() !== sender) {
      return res.status(403).json({ error: "Unauthorized sender" });
    }

    const message = new Message({ sender, receiver, content });
    const savedMessage = await message.save();
    res.status(201).json(savedMessage);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;