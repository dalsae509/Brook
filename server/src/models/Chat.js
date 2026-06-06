import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    wantedPost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WantedPost",
      default: null,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    closedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

chatSchema.index({ buyer: 1 });
chatSchema.index({ seller: 1 });
chatSchema.index({ product: 1, buyer: 1 });

const Chat = mongoose.model("Chat", chatSchema);

export default Chat;
