// models/Publication.js
import mongoose from "mongoose";

const publicationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  reward: {
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
  },
  geoLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], index: '2dsphere' } 
  }
}, {
  timestamps: true
});
publicationSchema.index({ geoLocation: '2dsphere' });
const Publication = mongoose.model("Publication", publicationSchema);
export default Publication;
