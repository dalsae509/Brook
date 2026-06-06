import mongoose from "mongoose";

// 검색어 집계 — 인기 검색어 산출용
const searchKeywordSchema = new mongoose.Schema(
  {
    keyword: { type: String, required: true, unique: true },
    count: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

searchKeywordSchema.index({ count: -1 });

const SearchKeyword = mongoose.model("SearchKeyword", searchKeywordSchema);

export default SearchKeyword;
