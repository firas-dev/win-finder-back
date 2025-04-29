import cloudinary from "../lib/cloudinary.js"
import express from "express";
import Publication from "../models/Publication.js";
import { geocodeAddress } from '../utils/geocode.js';
import Objet from "../models/Objet.js"; 
import Image from "../models/Image.js"; 
import protectRoute from "../middleware/auth.middleware.js";
import User from '../models/User.js';
import Notification from '../models/Notification.js';

const router = express.Router();


router.post("/", protectRoute, async (req, res) => {
  try {
    const { title, date, location, description, reward, color, itemType, category, images } = req.body;

    if (!title || !date || !location || !description || !color || !itemType || !category) {
      return res.status(400).json({ message: "Please provide the required fields" });
    }

    // ✅ Ensure location is a valid [lat, lon] array
    if (
      !Array.isArray(location) ||
      location.length !== 2 ||
      typeof location[0] !== 'number' ||
      typeof location[1] !== 'number'
    ) {
      return res.status(400).json({ message: "Location must be a [latitude, longitude] array of numbers" });
    }

    const [latitude, longitude] = location;

    // ✅ Convert to GeoJSON format
    const geoLocation = {
      type: "Point",
      coordinates: [longitude, latitude], // GeoJSON uses [lon, lat]
    };

    // ✅ Create Object
    const newObjet = new Objet({
      title,
      date,
      description,
      reward,
      color,
      itemType,
      category,
      location: geoLocation, // Use the fixed format
    });
    await newObjet.save();

    // ✅ Handle Images
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

 // 3. Create Publication
 const newPublication = new Publication({
  title,
  date,
  location: req.body.location, // store raw [lat, lon] if needed
  description,
  reward,
  objet: newObjet._id,
  user: req.user._id,
  geoLocation,
});

await newPublication.save();

// 4. Find nearby users (within 5km) and send notifications
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
      message: `An item matching your area was posted: ${title}`,
    });
    await notification.save();
  })
);
res.status(201).json({ message: "Publication created", publication: newPublication });

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


router.get("/user",protectRoute , async(req,res)=>{
  try {
    const items=Publication.find({user:req.user._id}).sort({createdAt: -1}); 
    res.json(items); 
  } catch (error) {
    console.error("get user items error",error); 
    res.status(500).json({message:"Server error"})
  }
}); 


router.get("/:id", protectRoute, async (req, res) => {
  try {
    const item = await Publication.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    // Optional: Only allow access to the owner
    /*if (item.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }*/

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

export default router;
