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
      .sort({ timestamp: -1 }) // Newest first
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/", protectRoute, async (req, res) => {
    try{
    const { sender, receiver, content } = req.body;

    if (!sender || !receiver || !content || content.trim() === "") {
      return res.status(400).json({ error: "Missing or invalid required fields" });
    }
    if (!validateObjectId(sender) || !validateObjectId(receiver)) {
      return res.status(400).json({ error: "Invalid sender or receiver ID" });
    }
    if (content.length > 1000) {
      return res.status(400).json({ error: "Message content exceeds 1000 characters" });
    }

    if (req.user._id.toString() !== sender) {
      return res.status(403).json({ error: "Unauthorized sender" });
    }

    const message = new Message({ sender, receiver, content });
    const savedMessage = await message.save();
    res.status(201).json(savedMessage);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.get("/conversations/:userId", protectRoute, async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("Received userId:", userId); // Debug
    console.log("Is userId valid?", mongoose.Types.ObjectId.isValid(userId)); // Debug
    if (!validateObjectId(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }
    if (req.user._id.toString() !== userId) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: new mongoose.Types.ObjectId(userId) }, { receiver: new mongoose.Types.ObjectId(userId) }],
        },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$sender", new mongoose.Types.ObjectId(userId)] },
              "$receiver",
              "$sender",
            ],
          },
          lastMessage: { $first: "$content" },
          timestamp: { $first: "$timestamp" },
          unread: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$receiver", new mongoose.Types.ObjectId(userId)] }, { $eq: ["$isRead", false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          id: "$_id",
          user: "$user.username",
          avatar: {
            $ifNull: ["$user.profileImage", "https://via.placeholder.com/40"],
          },
          lastMessage: 1,
          time: "$timestamp",
          unread: 1,
        },
      },
    ]);

    res.json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// New endpoint to mark messages as read
router.put("/mark-read/:userId1/:userId2", protectRoute, async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;

    if (!validateObjectId(userId1) || !validateObjectId(userId2)) {
      return res.status(400).json({ error: "Invalid user IDs" });
    }

    if (req.user._id.toString() !== userId1) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    await Message.updateMany(
      { sender: userId2, receiver: userId1, isRead: false },
      { $set: { isRead: true } }
    );

    res.json({ message: "Messages marked as read" });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    res.status(500).json({ error: "Failed to mark messages as read" });
  }
});

export default router;