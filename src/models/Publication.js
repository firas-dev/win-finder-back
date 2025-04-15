// models/Publication.js
import mongoose from "mongoose";

const publicationSchema = new mongoose.Schema({
  titre: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  lieu: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  recompense: {
    type: Number,
    default: 0
  },
  user:{
    type:mongoose.Schema.Types.ObjectId,
    ref:'User',
    required:true
  },
  objet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Objet",
    required: true
  }
}, {
  timestamps: true
});

const Publication = mongoose.model("Publication", publicationSchema);
export default Publication;
