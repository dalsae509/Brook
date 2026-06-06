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

// 플랫폼 전체 분석 — GMV/거래수/신규 유저/카테고리 분포/월별 추이
export const getAnalytics = async (req, res) => {
  try {
    const [totalUsers, totalProducts, productFacet, usersByMonth] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Product.aggregate([
        {
          $addFields: {
            isSold: {
              $or: [
                { $and: [{ $eq: ["$saleType", "fixed"] }, { $eq: ["$fixedStatus", "sold"] }] },
                { $and: [{ $eq: ["$saleType", "auction"] }, { $eq: ["$auctionTradeConfirmed", true] }] },
              ],
            },
            soldPrice: { $cond: [{ $eq: ["$saleType", "fixed"] }, "$fixedPrice", "$currentPrice"] },
          },
        },
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  gmv: { $sum: { $cond: ["$isSold", "$soldPrice", 0] } },
                  transactions: { $sum: { $cond: ["$isSold", 1, 0] } },
                },
              },
            ],
            categoryDistribution: [
              { $group: { _id: "$category", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
            ],
            salesByMonth: [
              { $match: { isSold: true, soldAt: { $ne: null } } },
              {
                $group: {
                  _id: { year: { $year: "$soldAt" }, month: { $month: "$soldAt" } },
                  gmv: { $sum: "$soldPrice" },
                  count: { $sum: 1 },
                },
              },
              { $sort: { "_id.year": 1, "_id.month": 1 } },
            ],
          },
        },
      ]),
      User.aggregate([
        {
          $group: {
            _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
    ]);

    const facet = productFacet[0];
    const summary = facet.summary[0] ?? { gmv: 0, transactions: 0 };
    const fmtMonth = (r) => `${r._id.year}-${String(r._id.month).padStart(2, "0")}`;

    return res.status(200).json({
      summary: { totalUsers, totalProducts, gmv: summary.gmv, transactions: summary.transactions },
      categoryDistribution: facet.categoryDistribution.map((c) => ({ name: c._id, value: c.count })),
      salesByMonth: facet.salesByMonth.map((r) => ({ month: fmtMonth(r), gmv: r.gmv, count: r.count })),
      usersByMonth: usersByMonth.map((r) => ({ month: fmtMonth(r), count: r.count })),
    });
  } catch (error) {
    console.error("admin getAnalytics error:", error.message);
    return res.status(500).json({ message: "서버 오류" });
  }
};
