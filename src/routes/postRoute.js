import cloudinary from "../lib/cloudinary.js"
import express from "express";
import Publication from "../models/Publication.js";
import Objet from "../models/Objet.js"; 
import Image from "../models/Image.js"; 
import protectRoute from "../middleware/auth.middleware.js";
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import axios from 'axios';

const router = express.Router();


const geocodeAddress = async (location) => {
  if (!location || typeof location !== 'string' || location.trim() === '') {
    throw new Error("Invalid location input");
  }

  const res = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: {
      q: location,
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




router.post("/", protectRoute, async (req, res) => {
  try {
    const { title, date, location, description, reward, color, itemType, category, images } = req.body;

    if (!title || !date || !description || !color || !itemType || !category) {
      return res.status(400).json({ message: "Please provide the required fields" });
    }
    if (!location || typeof location !== 'string' || location.trim() === '') {
      throw new Error("Invalid location input");
    }    
    let coordinates = [0, 0];
      if (location ) {
        try {
          coordinates = await geocodeAddress(location);
        } catch (geoErr) {
          console.warn("Geocoding failed:", geoErr.message);
          // You can choose to reject registration if geocoding fails
          return res.status(400).json({ message: "Invalid address provided" });
        }
      }

    // 1. Create the Objet (item)
    const newObjet = new Objet({ color, itemType, category });
    await newObjet.save();
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ message: "Please upload at least one image" });
    }

    const imageDocs = await Promise.all(
      images.map(async (imgDataUrl) => {
        if (!imgDataUrl.startsWith("data:image/")) {
          throw new Error("Invalid image format");
        }

        const uploadResponse = await cloudinary.uploader.upload(imgDataUrl);
        const imageUrl = uploadResponse.secure_url;

        const image = new Image({ url: imageUrl, objet: newObjet._id });
        await image.save();
        return image._id;
      })
    );

    newObjet.images = imageDocs;
    await newObjet.save();
    const geoLocation = {
      type: 'Point',
      coordinates
    };
    // 2. Create the Publication
    const newPublication = new Publication({
      title,
      date,
      location,
      description,
      reward,
      objet: newObjet._id,
      user: req.user._id,
      geoLocation // Add this field in your Publication schema if needed
    });
    await newPublication.save();


    const nearbyUsers = await User.find({
      location: {
        $near: {
          $geometry: geoLocation,
          $maxDistance: 5000,
        },
      },
      _id: { $ne: req.user._id },
    });
    

    await Promise.all(
      nearbyUsers.map(async (user) => {
        const notification = new Notification({
          userId: user._id,
          type: 'alert',
          title: 'Nearby item posted',
          message: `An item matching your area was posted: "${title}"`,
        });
        await notification.save();
      })
    );

    res.status(201).json({ message: "Publication created", Publication  });

  } catch (err) {
    console.error("Error creating publication:", err);
    res.status(500).json({ error: "Server error" });
  }
});





router.get("/", async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 5;
    const skip = (page - 1) * limit;

    // Populate the 'objet' field to include its full data
    const items = await Publication.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "username profileImage")
      .populate({
        path: "objet",  // Populate the 'objet' field
        populate: {
          path: "images",  // Populate the 'images' field within 'objet'
          select: "url"    // Only select the 'url' field of the image
        }
      });
    const total = await Publication.countDocuments();
    res.send({
      items,
      currentPage: page,
      totalItems: total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.log("error in get all items route", error);
    res.status(500).json({ message: "internal server error" });
  }
});


router.get("/:id", protectRoute, async (req, res) => {
  try {
    const item = await Publication.findById(req.params.id)
    .populate('user', 'username profileImage rating')
    .populate({
      path: "objet",  // Populate the 'objet' field
      populate: {
        path: "images",  // Populate the 'images' field within 'objet'
        select: "url"    // Only select the 'url' field of the image
      }
    });
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(200).json(item); // ✅ Send back the item
  } catch (error) {
    console.error("Error fetching item by ID:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


router.delete("/:id", protectRoute , async (req, res) => {
  try {
    const item = await Publication.findById(req.params.id).populate("objet");

    if (!item) {
      return res.status(400).json({ message: "item not found" });
    }

    if (item.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "UNAUTHORIZED" });
    }

    // Check if objet exists
    if (item.objet) {
      const objetId = item.objet._id;

      // Delete associated images
      const images = await Image.find({ objet: objetId });

      await Promise.all(
        images.map(async (img) => {
          const publicId = img.url.split("/").pop().split(".")[0];
          try {
            await cloudinary.uploader.destroy(publicId);
          } catch (err) {
            console.warn("Cloudinary delete error:", err.message);
          }
          await img.deleteOne();
        })
      );

      // Delete the objet
      await Objet.findByIdAndDelete(objetId);
    }

    // Delete the publication
    await item.deleteOne();

    res.json({ message: "Item and related data successfully deleted" });
  } catch (error) {
    console.log("error deleting item", error);
    res.status(500).json({ message: "Internal server Error" });
  }
});

router.get("/user/:id",protectRoute , async(req,res)=>{
  try {
    const userId = req.params.id;
    console.log("userId: ",userId)
    const items = await Publication.find({ user: userId }).sort({ createdAt: -1 });  
    res.json(items); 
  } catch (error) {
    console.error("get user items error",error); 
    res.status(500).json({message:"Server error"})
  }
}); 

export default router;
