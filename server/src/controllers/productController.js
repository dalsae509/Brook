import Product from "../models/Product.js";
import { validateBidTiers, getBidUnit } from "../utils/bidUnit.js";
import { CATEGORIES } from "../config/categories.js";

export const createProduct = async (req, res) => {
  try {
    const {
      title, description, category, images,
      saleType = "auction",
      fixedPrice, startPrice,
      onFailedAuction = "close",
      bidTiers,
    } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({
        message: "상품명, 설명, 카테고리를 모두 입력해주세요.",
      });
    }

    if (title.trim().length > 100) {
      return res.status(400).json({ message: "상품명은 100자 이하여야 합니다." });
    }
    if (description.trim().length > 2000) {
      return res.status(400).json({ message: "상품 설명은 2000자 이하여야 합니다." });
    }
    if (!CATEGORIES.includes(category.trim())) {
      return res.status(400).json({ message: "유효하지 않은 카테고리입니다." });
    }

    const productData = {
      seller: req.user._id,
      title,
      description,
      category,
      images: Array.isArray(images) ? images.slice(0, 5) : [],
      saleType,
    };

    if (saleType === "fixed") {
      if (fixedPrice === undefined) {
        return res.status(400).json({ message: "즉시 판매가를 입력해주세요." });
      }
      const numericFixedPrice = Number(fixedPrice);
      if (Number.isNaN(numericFixedPrice) || numericFixedPrice < 0) {
        return res.status(400).json({ message: "즉시 판매가는 0 이상의 숫자여야 합니다." });
      }
      productData.fixedPrice = numericFixedPrice;
    } else {
      if (startPrice === undefined) {
        return res.status(400).json({ message: "시작가를 입력해주세요." });
      }
      const numericStartPrice = Number(startPrice);
      if (Number.isNaN(numericStartPrice) || numericStartPrice < 0) {
        return res.status(400).json({ message: "시작가는 0 이상의 숫자여야 합니다." });
      }
      productData.startPrice = numericStartPrice;
      productData.currentPrice = numericStartPrice;
      productData.onFailedAuction = onFailedAuction;

      if (onFailedAuction === "convert") {
        if (fixedPrice === undefined) {
          return res.status(400).json({ message: "유찰 전환 시 즉시 판매가를 입력해주세요." });
        }
        const numericFixedPrice = Number(fixedPrice);
        if (Number.isNaN(numericFixedPrice) || numericFixedPrice < 0) {
          return res.status(400).json({ message: "즉시 판매가는 0 이상의 숫자여야 합니다." });
        }
        productData.fixedPrice = numericFixedPrice;
      }

      if (bidTiers !== undefined) {
        const tiersError = validateBidTiers(bidTiers);
        if (tiersError) return res.status(400).json({ message: tiersError });
        productData.bidTiers = bidTiers;
      }
    }

    const product = await Product.create(productData);

    return res.status(201).json({
      message: "상품 등록 성공",
      product,
    });
  } catch (error) {
    console.error("createProduct error:", error);
    return res.status(500).json({
      message: "서버 오류",
    });
  }
};

export const getProducts = async (req, res) => {
  try {
    const {
      search = "",
      category = "",
      status = "",
      fixedStatus = "",
      saleType = "",
      sort = "latest",
      page: pageParam = "1",
      limit: limitParam = "20",
      minPrice = "",
      maxPrice = "",
      seller = "",
    } = req.query;

    const page = Math.max(1, parseInt(pageParam) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(limitParam) || 20));

    const filter = {};

    if (search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.title = { $regex: escaped, $options: "i" };
    }

    if (category.trim()) {
      filter.category = category.trim();
    }

    if (saleType.trim()) {
      filter.saleType = saleType.trim();
    }

    if (status.trim()) {
      filter.auctionStatus = status.trim();
    }

    if (fixedStatus.trim()) {
      filter.fixedStatus = fixedStatus.trim();
    }

    if (seller.trim()) {
      filter.seller = seller.trim();
    }

    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    if (!Number.isNaN(min) || !Number.isNaN(max)) {
      const priceField = saleType.trim() === "fixed" ? "fixedPrice" : "currentPrice";
      filter[priceField] = {};
      if (!Number.isNaN(min)) filter[priceField].$gte = min;
      if (!Number.isNaN(max)) filter[priceField].$lte = max;
    }

    let sortOption = { createdAt: -1 };

    if (sort === "latest") {
      sortOption = { createdAt: -1 };
    } else if (sort === "oldest") {
      sortOption = { createdAt: 1 };
    } else if (sort === "priceHigh") {
      sortOption = { currentPrice: -1, fixedPrice: -1 };
    } else if (sort === "priceLow") {
      sortOption = { currentPrice: 1, fixedPrice: 1 };
    } else if (sort === "popular") {
      sortOption = { views: -1 };
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("seller", "name")
        .sort(sortOption)
        .skip((page - 1) * limit)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      message: "상품 목록 조회 성공",
      products,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("getProducts error:", error);
    return res.status(500).json({
      message: "서버 오류",
    });
  }
};

export const getProductDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true }
    )
      .populate("seller", "name")
      .populate("winner", "name");

    if (!product) {
      return res.status(404).json({
        message: "상품을 찾을 수 없습니다.",
      });
    }

    const productObj = product.toObject();

    if (product.saleType === "auction" && product.currentPrice != null) {
      productObj.bidUnit = getBidUnit(product.currentPrice, product.bidTiers);
      productObj.minBidAmount = product.currentPrice + productObj.bidUnit;
    }

    return res.status(200).json({
      message: "상품 상세 조회 성공",
      product: productObj,
    });
  } catch (error) {
    console.error("getProductDetail error:", error);
    return res.status(500).json({
      message: "서버 오류",
    });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, images, startPrice, fixedPrice, bidTiers } = req.body;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: "상품을 찾을 수 없습니다." });
    }

    if (product.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "본인이 등록한 상품만 수정할 수 있습니다." });
    }

    const isEditable = product.saleType === "fixed"
      ? product.fixedStatus === "available"
      : product.auctionStatus === "pending";

    if (!isEditable) {
      return res.status(400).json({ message: "거래가 진행 중인 상품은 수정할 수 없습니다." });
    }

    if (title !== undefined) product.title = title;
    if (description !== undefined) product.description = description;
    if (category !== undefined) {
      if (!CATEGORIES.includes(category.trim())) {
        return res.status(400).json({ message: "유효하지 않은 카테고리입니다." });
      }
      product.category = category.trim();
    }
    if (Array.isArray(images)) product.images = images.slice(0, 5);

    if (product.saleType === "fixed") {
      if (fixedPrice !== undefined) {
        const numericFixedPrice = Number(fixedPrice);
        if (Number.isNaN(numericFixedPrice) || numericFixedPrice < 0) {
          return res.status(400).json({ message: "즉시 판매가는 0 이상의 숫자여야 합니다." });
        }
        product.fixedPrice = numericFixedPrice;
      }
    } else {
      if (bidTiers !== undefined) {
        const tiersError = validateBidTiers(bidTiers);
        if (tiersError) return res.status(400).json({ message: tiersError });
        product.bidTiers = bidTiers;
      }

      if (startPrice !== undefined) {
        const numericStartPrice = Number(startPrice);
        if (Number.isNaN(numericStartPrice) || numericStartPrice < 0) {
          return res.status(400).json({ message: "시작가는 0 이상의 숫자여야 합니다." });
        }
        product.startPrice = numericStartPrice;
        product.currentPrice = numericStartPrice;
      }
    }

    await product.save();

    return res.status(200).json({
      message: "상품 수정 성공",
      product,
    });
  } catch (error) {
    console.error("updateProduct error:", error);
    return res.status(500).json({
      message: "서버 오류",
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        message: "상품을 찾을 수 없습니다.",
      });
    }

    if (product.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "본인이 등록한 상품만 삭제할 수 있습니다.",
      });
    }

    const isLocked =
      (product.saleType === "fixed" && product.fixedStatus === "reserved") ||
      (product.saleType === "auction" && product.auctionStatus === "live");
    if (isLocked) {
      return res.status(400).json({ message: "거래가 진행 중인 상품은 삭제할 수 없습니다." });
    }

    const isCompleted =
      (product.saleType === "fixed" && product.fixedStatus === "sold") ||
      (product.saleType === "auction" && product.auctionStatus === "ended" && product.winner);
    if (isCompleted) {
      return res.status(400).json({ message: "거래가 완료된 상품은 삭제할 수 없습니다." });
    }

    await product.deleteOne();

    return res.status(200).json({
      message: "상품 삭제 성공",
    });
  } catch (error) {
    console.error("deleteProduct error:", error);
    return res.status(500).json({
      message: "서버 오류",
    });
  }
};

export const getCategories = (req, res) => {
  return res.status(200).json({
    message: "카테고리 목록 조회 성공",
    categories: CATEGORIES,
  });
};