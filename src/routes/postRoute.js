import cloudinary from "../lib/cloudinary.js"
import express from "express";
import Publication from "../models/Publication.js";
import Objet from "../models/Objet.js"; 
import Image from "../models/Image.js"; 
import protectRoute from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", protectRoute ,async (req, res) => {
  try {
    const { titre, date, lieu, description, recompense,color, status,categorie, images } = req.body;
    if(!titre||!date||!lieu||!description||!color||!status||!categorie||!images){
      return res.status(400).json({message: "Please provide the required fields"});
    }
    // 1. Create Objet
    const newObjet = new Objet({
      color, // ✅ fixed from 'couleur'
      status,
      categorie
    });
    await newObjet.save();

    // 2. Create and attach Images
    const imageDocs = await Promise.all(
      images.map(async (img) => {
        const uploadResponse = await cloudinary.uploader.upload(img.url); 
        const imageUrl=uploadResponse.secure_url;
        const image = new Image({ url: imageUrl, objet: newObjet._id });
        await image.save();
        return image._id;
      })
    );
    newObjet.images = imageDocs;
    await newObjet.save(); // update with image refs

    // 3. Create Publication with objet ref
    const newPublication = new Publication({
      titre,
      date,
      lieu,
      description,
      recompense,
      objet: newObjet._id,
      //user:req.user._id
      user:"67fbf7b3d94ce4f7747a5e1b"
    });
    await newPublication.save();

    res.status(201).json({ message: "Publication created", publication: newPublication });
  } catch (err) {
    console.error("Error creating publication:", err);
    res.status(500).json({ error: "Server error" });
  }
});


router.get("/",async(req,res)=>{
    try {
        const page=req.query.page||1; 
        const limit=req.query.limit||5; 
        const skip =(page-1)*limit; 

        const items=await Publication.find().sort({createdAt: -1})
        .skip(skip)
        .limit(limit)
        .populate("user","usernama profileImage"); 

        const total=await Publication.countDocuments(); 
        res.send({
            items,
            currentPage:page,
            totalItems:total,
            totalPages:Math.ceil(total/limit),
        }); 
    } catch (error) {
        console.log("error in get all items route ",error); 
        res.status(500).json({message :"internal server error"}) ; 
    }
});

router.get("/user",/*protectRoute ,*/ async(req,res)=>{
  try {
    const items=Publication.find({user:req.user._id}).sort({createdAt: -1}); 
    res.json(items); 
  } catch (error) {
    console.error("get user items error",error); 
    res.status(500).json({message:"Server error"})
  }
})


router.delete("/:id", /*protectRoute ,*/ async (req, res) => {
  try {
    const item = await Publication.findById(req.params.id).populate("objet");

    if (!item) {
      return res.status(400).json({ message: "item not found" });
    }

    /*if (item.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "UNAUTHORIZED" });
    }*/

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
