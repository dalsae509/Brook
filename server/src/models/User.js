import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "이름은 필수입니다."],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "이메일은 필수입니다."],
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, "비밀번호는 필수입니다."],
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    refreshTokens: {
      type: [String],
      default: [],
    },
    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    brookScore: { type: Number, default: 36.5, min: 0, max: 99 },
    completedDeals: { type: Number, default: 0, min: 0 },
    totalDeals: { type: Number, default: 0, min: 0 },
    cancelledDeals: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

export default User;