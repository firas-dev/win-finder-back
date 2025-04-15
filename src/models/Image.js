import mongoose from "mongoose";

const imageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  objet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Objet",
    required: true
  }
}, {
  timestamps: true
});

const Image = mongoose.model("Image", imageSchema);
export default Image;
