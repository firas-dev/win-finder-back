import express from "express" ; 
import User from "../models/User.js";
import jwt from "jsonwebtoken" ; 
import axios from 'axios';

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
  
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
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


export default router