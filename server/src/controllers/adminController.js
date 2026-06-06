import User from "../models/User.js";
import Product from "../models/Product.js";
import WantedPost from "../models/WantedPost.js";
import WantedComment from "../models/WantedComment.js";
import { finalizeAuction } from "../utils/auctionScheduler.js";

export const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password -refreshTokens").sort({ createdAt: -1 });
    return res.status(200).json({ users });
  } catch (error) {
    console.error("admin getUsers error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: "본인 계정은 삭제할 수 없습니다." });
    }

    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }

    return res.status(200).json({ message: "사용자 삭제 완료" });
  } catch (error) {
    console.error("admin deleteUser error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const getAdminProducts = async (req, res) => {
  try {
    const { page: pageParam = "1", search = "" } = req.query;
    const page = Math.max(1, parseInt(pageParam) || 1);
    const limit = 20;

    const filter = {};
    if (search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.title = { $regex: escaped, $options: "i" };
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("seller", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    return res.status(200).json({ products, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("admin getAdminProducts error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const forceDeleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findByIdAndDelete(productId);
    if (!product) {
      return res.status(404).json({ message: "상품을 찾을 수 없습니다." });
    }

    return res.status(200).json({ message: "상품 강제 삭제 완료" });
  } catch (error) {
    console.error("admin forceDeleteProduct error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const getAdminWantedPosts = async (req, res) => {
  try {
    const { page: pageParam = "1", search = "" } = req.query;
    const page = Math.max(1, parseInt(pageParam) || 1);
    const limit = 20;
    const filter = {};
    if (search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.title = { $regex: escaped, $options: "i" };
    }
    const [posts, total] = await Promise.all([
      WantedPost.find(filter).populate("author", "name email").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      WantedPost.countDocuments(filter),
    ]);
    return res.status(200).json({ posts, total, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const forceDeleteWantedPost = async (req, res) => {
  try {
    const post = await WantedPost.findByIdAndDelete(req.params.postId);
    if (!post) return res.status(404).json({ message: "게시글을 찾을 수 없습니다." });
    await WantedComment.deleteMany({ wantedPost: req.params.postId });
    return res.status(200).json({ message: "삭제 완료" });
  } catch (error) {
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const forceEndAuction = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "상품을 찾을 수 없습니다." });
    }
    if (product.auctionStatus !== "live") {
      return res.status(400).json({ message: "진행 중인 경매만 강제 종료할 수 있습니다." });
    }

    const io = req.app.get("io");
    await finalizeAuction(product._id, io, "admin");

    return res.status(200).json({ message: "경매 강제 종료 완료" });
  } catch (error) {
    console.error("admin forceEndAuction error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};
