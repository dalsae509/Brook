import Product from "../models/Product.js";
import Bid from "../models/Bid.js";
import User from "../models/User.js";

export const getMyProducts = async (req, res) => {
  try {
    const products = await Product.find({ seller: req.user._id })
      .populate("seller", "name")
      .populate("winner", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "내 상품 조회 성공",
      products,
    });
  } catch (error) {
    console.error("getMyProducts error:", error);
    return res.status(500).json({
      message: "서버 오류",
    });
  }
};

export const getMyBids = async (req, res) => {
  try {
    const bids = await Bid.find({ bidder: req.user._id })
      .populate({
        path: "product",
        populate: [
          { path: "seller", select: "name" },
          { path: "winner", select: "name" },
        ],
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "내 입찰 내역 조회 성공",
      bids,
    });
  } catch (error) {
    console.error("getMyBids error:", error);
    return res.status(500).json({
      message: "서버 오류",
    });
  }
};

export const getMyWins = async (req, res) => {
  try {
    const products = await Product.find({
      winner: req.user._id,
      auctionStatus: "ended",
    })
      .populate("seller", "name")
      .populate("winner", "name")
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      message: "내 낙찰 상품 조회 성공",
      products,
    });
  } catch (error) {
    console.error("getMyWins error:", error);
    return res.status(500).json({
      message: "서버 오류",
    });
  }
};

export const toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "상품을 찾을 수 없습니다." });
    }

    const user = await User.findById(req.user._id).select("wishlist");
    const isWishlisted = user.wishlist.some((id) => id.toString() === productId);

    if (isWishlisted) {
      await User.findByIdAndUpdate(req.user._id, { $pull: { wishlist: productId } });
    } else {
      await User.findByIdAndUpdate(req.user._id, { $addToSet: { wishlist: productId } });
    }

    return res.status(200).json({ isWishlisted: !isWishlisted });
  } catch (error) {
    console.error("toggleWishlist error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("name createdAt");
    if (!user) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }
    return res.status(200).json({ user });
  } catch (error) {
    console.error("getUserProfile error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const getMyPurchases = async (req, res) => {
  try {
    const products = await Product.find({
      buyer: req.user._id,
      saleType: "fixed",
    })
      .populate("seller", "name")
      .sort({ updatedAt: -1 });

    return res.status(200).json({ message: "내 구매 내역 조회 성공", products });
  } catch (error) {
    console.error("getMyPurchases error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const getMyWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("wishlist")
      .populate({
        path: "wishlist",
        select: "title category images saleType fixedPrice fixedStatus currentPrice auctionStatus",
      });

    return res.status(200).json({ wishlist: user.wishlist });
  } catch (error) {
    console.error("getMyWishlist error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};