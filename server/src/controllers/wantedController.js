import WantedPost from "../models/WantedPost.js";
import WantedComment from "../models/WantedComment.js";
import Chat from "../models/Chat.js";
import { createNotification } from "../utils/notificationService.js";

export const getMyPosts = async (req, res) => {
  try {
    const posts = await WantedPost.find({ author: req.user._id })
      .sort({ createdAt: -1 });
    res.json({ posts });
  } catch (error) {
    console.error("getMyPosts error:", error.message);
    res.status(500).json({ message: "서버 오류" });
  }
};

export const getMyCommentedPosts = async (req, res) => {
  try {
    const postIds = await WantedComment.distinct("wantedPost", { author: req.user._id });
    const posts = await WantedPost.find({ _id: { $in: postIds } })
      .sort({ createdAt: -1 });
    res.json({ posts });
  } catch (error) {
    console.error("getMyCommentedPosts error:", error.message);
    res.status(500).json({ message: "서버 오류" });
  }
};

export const getPosts = async (req, res) => {
  try {
    const { page = 1, category, status = "open", search = "" } = req.query;
    const limit = 12;
    const query = {};
    if (status !== "all") query.status = status;
    if (category) query.category = category;
    if (search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.title = { $regex: escaped, $options: "i" };
    }

    const [posts, total] = await Promise.all([
      WantedPost.find(query)
        .populate("author", "name")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      WantedPost.countDocuments(query),
    ]);

    const postIds = posts.map((p) => p._id);
    const commentCounts = await WantedComment.aggregate([
      { $match: { wantedPost: { $in: postIds } } },
      { $group: { _id: "$wantedPost", count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(commentCounts.map((c) => [c._id.toString(), c.count]));
    const postsWithCount = posts.map((p) => ({
      ...p.toObject(),
      commentCount: countMap[p._id.toString()] ?? 0,
    }));

    res.json({ posts: postsWithCount, total, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("getPosts error:", error.message);
    res.status(500).json({ message: "서버 오류" });
  }
};

export const getPost = async (req, res) => {
  try {
    const post = await WantedPost.findById(req.params.id).populate("author", "name");
    if (!post) return res.status(404).json({ message: "게시글을 찾을 수 없습니다." });

    const comments = await WantedComment.find({ wantedPost: post._id })
      .populate("author", "name")
      .sort({ createdAt: 1 });

    res.json({ post, comments });
  } catch (error) {
    console.error("getPost error:", error.message);
    res.status(500).json({ message: "서버 오류" });
  }
};

export const createPost = async (req, res) => {
  try {
    const { title, description, category, targetPrice } = req.body;
    const post = await WantedPost.create({
      author: req.user._id,
      title,
      description,
      category,
      targetPrice: targetPrice || null,
    });
    res.status(201).json({ message: "게시글 등록 성공", post });
  } catch (error) {
    console.error("createPost error:", error.message);
    res.status(500).json({ message: "서버 오류" });
  }
};

export const closePost = async (req, res) => {
  try {
    const post = await WantedPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "게시글을 찾을 수 없습니다." });
    if (post.author.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "권한이 없습니다." });

    post.status = "closed";
    await post.save();
    res.json({ message: "거래 완료 처리됨", post });
  } catch (error) {
    console.error("closePost error:", error.message);
    res.status(500).json({ message: "서버 오류" });
  }
};

export const updatePost = async (req, res) => {
  try {
    const post = await WantedPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "게시글을 찾을 수 없습니다." });
    if (post.author.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "권한이 없습니다." });
    if (post.status !== "open")
      return res.status(400).json({ message: "마감된 게시글은 수정할 수 없습니다." });

    const { title, description, category, targetPrice } = req.body;
    if (title) post.title = title;
    if (description) post.description = description;
    if (category) post.category = category;
    post.targetPrice = targetPrice != null ? Number(targetPrice) : null;
    await post.save();
    res.json({ message: "수정 완료", post });
  } catch (error) {
    console.error("updatePost error:", error.message);
    res.status(500).json({ message: "서버 오류" });
  }
};

export const deletePost = async (req, res) => {
  try {
    const post = await WantedPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "게시글을 찾을 수 없습니다." });
    if (post.author.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "권한이 없습니다." });

    await Promise.all([
      WantedComment.deleteMany({ wantedPost: post._id }),
      Chat.deleteMany({ wantedPost: post._id }),
    ]);
    await post.deleteOne();
    res.json({ message: "삭제 완료" });
  } catch (error) {
    console.error("deletePost error:", error.message);
    res.status(500).json({ message: "서버 오류" });
  }
};

export const addComment = async (req, res) => {
  try {
    const post = await WantedPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "게시글을 찾을 수 없습니다." });
    if (post.status === "closed") return res.status(400).json({ message: "종료된 게시글입니다." });
    if (post.author.toString() === req.user._id.toString())
      return res.status(403).json({ message: "본인 게시글에는 댓글을 달 수 없습니다." });

    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: "내용을 입력해주세요." });

    const comment = await WantedComment.create({
      wantedPost: post._id,
      author: req.user._id,
      content: content.trim(),
    });

    const populated = await WantedComment.findById(comment._id).populate("author", "name");

    // 게시글 작성자에게 알림
    const io = req.app.get("io");
    await createNotification(io, post.author, {
      type: "wanted_comment",
      message: `"${post.title}" 구매 요청에 새 댓글이 달렸습니다.`,
      wantedPostId: post._id,
    });

    res.status(201).json({ message: "댓글 등록 성공", comment: populated });
  } catch (error) {
    console.error("addComment error:", error.message);
    res.status(500).json({ message: "서버 오류" });
  }
};

export const deleteComment = async (req, res) => {
  try {
    const comment = await WantedComment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "댓글을 찾을 수 없습니다." });
    if (comment.author.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "권한이 없습니다." });

    await comment.deleteOne();
    res.json({ message: "삭제 완료" });
  } catch (error) {
    console.error("deleteComment error:", error.message);
    res.status(500).json({ message: "서버 오류" });
  }
};

export const startChatWithCommenter = async (req, res) => {
  try {
    const post = await WantedPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "게시글을 찾을 수 없습니다." });
    if (post.author.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "게시글 작성자만 채팅을 시작할 수 있습니다." });

    const comment = await WantedComment.findById(req.params.commentId);
    if (!comment || comment.wantedPost.toString() !== post._id.toString())
      return res.status(404).json({ message: "댓글을 찾을 수 없습니다." });

    const existing = await Chat.findOne({
      wantedPost: post._id,
      buyer: req.user._id,
      seller: comment.author,
    });
    if (existing) return res.status(200).json({ message: "기존 채팅방", chat: existing });

    const chat = await Chat.create({
      wantedPost: post._id,
      buyer: req.user._id,
      seller: comment.author,
    });

    // 댓글 작성자(판매자)에게 채팅 요청 알림
    const io = req.app.get("io");
    await createNotification(io, comment.author, {
      type: "wanted_chat_started",
      message: `"${post.title}" 구매 요청자가 채팅을 요청했습니다.`,
      wantedPostId: post._id,
    });

    res.status(201).json({ message: "채팅방 생성 성공", chat });
  } catch (error) {
    console.error("startChatWithCommenter error:", error.message);
    res.status(500).json({ message: "서버 오류" });
  }
};
