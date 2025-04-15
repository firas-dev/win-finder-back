// models/Objet.js
import mongoose from "mongoose";

const objetSchema = new mongoose.Schema({
  color: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Lost', 'Found'],
    required: true,
  },
  categorie: {
    type: String,
    enum: ['electronic', 'accessory', 'document', 'other'],
    required: true,
  },
  images: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Image"
  }]
}, { timestamps: true });

const Objet = mongoose.model("Objet", objetSchema);
export default Objet;
