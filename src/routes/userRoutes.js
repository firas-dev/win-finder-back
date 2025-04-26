import User from "../models/User.js";
import protectRoute from "../middleware/auth.middleware.js";
import express from "express";
import cloudinary from "../lib/cloudinary.js"

const router = express.Router();
router.get('/', protectRoute, async (req, res) => {
    try {
      // req.user is set by authenticateToken middleware (contains user ID from JWT)
      const user = await User.findById(req.user.id).select('-password'); // Exclude password
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Return user profile
      res.json({
        user: {
          username: user.username,
          email: user.email,
          phone: user.phone,
          adresse: user.adresse,
          profileImage: user.profileImage || '', // Fallback to empty string if null
        },
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

router.put("/update-profile",protectRoute,async(req,res) => {
    try {
        const { username, email, phone, adresse, profileImage, password } = req.body;
        const userId = req.user.id; 

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found!" });
        }

        // Update fields if sent
        if (username) user.username = username;
        if (email) user.email = email;
        if (phone) user.phone = phone;
        if (adresse) user.adresse = adresse;
        if (profileImage) user.profileImage = profileImage;
        await user.save(); 
        res.status(200).json({
            message: "Profile updated successfully!",
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                phone: user.phone,
                adresse: user.adresse,
                profileImage: user.profileImage,
            },
        });
    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}); 

export default router;