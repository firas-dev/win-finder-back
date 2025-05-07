import express from "express" ; 
import User from "../models/User.js";
import jwt from "jsonwebtoken" ; 
import axios from 'axios';
import crypto from "crypto";
import nodemailer from "nodemailer";

const router=express.Router(); 
const generateToken=(userId) => {
   return jwt.sign({userId},process.env.JWT_SECRET,{expiresIn:"15d"}) ; 

}

const geocodeAddress = async (adresse) => {
    const res = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: adresse,
        format: 'json',
        limit: 1,
      },
      headers: {
        'User-Agent': 'FinderApp/1.0 (firaselhaj3@gmail.com)'
      }
    });
    console.log("Geocoding response:", res.data); 
    if (res.data.length > 0) {
      return [
        parseFloat(res.data[0].lon),
        parseFloat(res.data[0].lat)
      ];
    } else {
      throw new Error("Address not found");
    }
  };
  
  router.post("/register", async (req, res) => {
    try {
      const { email, username, password, phone, adresse } = req.body;
      if (!username?.trim() || !email?.trim() || !password?.trim() || !phone?.trim()) {
        return res.status(400).json({ message: "All fields are required!" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password should be at least 6 characters long" });
      }
      if (username.length < 3) {
        return res.status(400).json({ message: "Username should be at least 3 characters long" });
      }
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({ message: "Username already exists" });
      }
  
      const profileImage = `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${username}`;
  
      // Geocode address to get coordinates
      let coordinates = [0, 0];
      if (adresse && adresse.trim()) {
        try {
          coordinates = await geocodeAddress(adresse);
        } catch (geoErr) {
          console.warn("Geocoding failed:", geoErr.message);
          // You can choose to reject registration if geocoding fails
          return res.status(400).json({ message: "Invalid address provided" });
        }
      }
  
      const user = new User({
        email,
        username,
        phone,
        adresse,
        password,
        profileImage,
        location: {
          type: 'Point',
          coordinates
        }
      });
  
      await user.save();
  
      const token = generateToken(user._id);
      res.status(201).json({
        token,
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          adresse: user.adresse,
          profileImage: user.profileImage,
          location: user.location
        },
      });
  
    } catch (error) {
      console.error("Error in register route:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

router.post("/login",async(req,res)=>{
    try {
        const{email,password}=req.body;
        if(!email || !password){
            return res.status(400).json({message: "All fields are required! "});
        }
        const user =await User.findOne({email}); 
        if(!user){
            return res.status(400).json({message: "Invalid credentials"});
        }
        const isPasswordCorrect = await user.comparePassword(password); 
        if(!isPasswordCorrect){
            return res.status(400).json({message: "Invalid credentials"});
        }


        const token = generateToken(user._id); 
        res.status(201).json({
            token,
            user:{
                _id:user._id, 
                username:user.username, 
                email:user.email, 
                profileImage:user.profileImage
            },
        }); 

    } catch (error) {
        console.log("Error in login route",error); 
        res.status(500).json({message:"Internal server error !!!"}); 
    }
});
//node mailer configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "No account with that email found" });
    }

    // Generate token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = Date.now() + 1000 * 60 * 30; 

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;

    await user.save();

    const resetUrl = `finderapp://reset-password/${resetToken}`;

    // Send email
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "FinderApp - Password Reset Request",
      html: `
        <p>Hello ${user.username},</p>
        <p>You requested a password reset for your FinderApp account.</p>
        <p>Click the link below to reset your password (valid for 30 minutes):</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <br />
        <p>If you didn’t request this, please ignore this email.</p>
        <p>Thanks,<br />FinderApp Team</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Reset instructions sent to your email" });

  } catch (error) {
    console.error("Error in forgot-password route:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    // Find user with a valid (not expired) token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Update password and remove reset token/expiry
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.status(200).json({ message: "Password has been reset successfully" });

  } catch (error) {
    console.error("Error in reset-password route:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});




export default router