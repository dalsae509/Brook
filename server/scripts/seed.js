/**
 * 데모 데이터 시드 스크립트
 * 실행: cd server && npm run seed
 * ⚠️ User/Product/Bid/ProxyBid/Review/SearchKeyword 컬렉션을 비우고 다시 채웁니다.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "../src/models/User.js";
import Product from "../src/models/Product.js";
import Bid from "../src/models/Bid.js";
import ProxyBid from "../src/models/ProxyBid.js";
import Review from "../src/models/Review.js";
import SearchKeyword from "../src/models/SearchKeyword.js";
import { CATEGORIES } from "../src/config/categories.js";
import { recalculateBrookScore } from "../src/utils/brookScoreUtil.js";

dotenv.config();

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];
const pickWeighted = (pairs) => {
  // pairs: [[value, weight], ...]
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of pairs) {
    if ((r -= w) < 0) return v;
  }
  return pairs[0][0];
};
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const img = (seed) => `https://picsum.photos/seed/${seed}/600/600`;

const KOREAN_NAMES = [
  "김민준", "이서연", "박지후", "최하은", "정도윤", "강시우", "조유나", "윤지안",
  "장하준", "임서윤", "한지호", "오예준", "서수아", "신건우", "권나윤", "황민서",
  "안준서", "송지원", "전예린", "홍태양",
];

const PRODUCT_NAMES = {
  "디지털/전자기기": ["아이폰 15 프로", "갤럭시 S24 울트라", "아이패드 에어", "맥북 프로 14", "에어팟 프로 2", "닌텐도 스위치 OLED", "LG 그램 노트북", "갤럭시 워치 6"],
  "의류/패션": ["나이키 후드티", "노스페이스 패딩", "리바이스 청바지", "뉴발란스 운동화", "유니클로 코트", "아디다스 트랙탑"],
  "도서/음반": ["클린 코드", "이펙티브 자바", "데미안", "LP 레코드 모음", "토비의 스프링", "자료구조 교재"],
  "스포츠/레저": ["요가매트 세트", "덤벨 20kg", "캠핑 텐트 4인용", "로드 자전거", "등산 스틱", "골프 드라이버"],
  "가구/인테리어": ["원목 책상", "허먼밀러 의자", "3단 책장", "LED 스탠드", "패브릭 소파", "수납 서랍장"],
  "생활용품": ["다이슨 청소기", "에어프라이어", "전기포트", "공기청정기", "가습기"],
  "식품/음료": ["원두 커피 1kg", "수제 잼 세트", "유기농 꿀", "프리미엄 녹차"],
  "뷰티/미용": ["설화수 세트", "고데기", "향수 50ml", "스킨케어 세트"],
  "장난감/취미": ["레고 테크닉", "건프라 RG", "보드게임 세트", "드론 미니"],
  "자동차용품": ["블랙박스 2채널", "차량용 청소기", "엔진오일 세트"],
  "유아동용품": ["유모차", "아기 침대", "장난감 정리함"],
  "예술/공예": ["수채화 물감 세트", "도자기 화분", "캘리그래피 펜"],
  "기타": ["미개봉 기프티콘", "캠핑 랜턴", "휴대용 선풍기"],
};

const REVIEW_COMMENTS = [
  "친절하고 빠른 거래 감사합니다!", "상품 상태 설명과 동일해요. 만족합니다.",
  "응답이 빨라서 좋았어요.", "포장 꼼꼼하게 잘 해주셨어요.",
  "약속 시간 잘 지켜주셔서 감사합니다.", "다음에 또 거래하고 싶어요.",
  "가격도 합리적이고 좋네요.", "", "",
];

const POPULAR_KEYWORDS = [
  ["아이폰", 42], ["맥북", 31], ["갤럭시", 28], ["에어팟", 24], ["노트북", 19],
  ["청바지", 14], ["텐트", 11], ["레고", 9], ["커피", 7], ["의자", 5],
];

async function seed() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI 환경변수가 필요합니다.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB 연결됨");

  console.log("기존 데이터 삭제 중...");
  await Promise.all([
    User.deleteMany({}), Product.deleteMany({}), Bid.deleteMany({}),
    ProxyBid.deleteMany({}), Review.deleteMany({}), SearchKeyword.deleteMany({}),
  ]);

  const hash = await bcrypt.hash("Brook1234", 10);

  // 데모 계정 + 일반 유저
  const demoSpecs = [
    { name: "구매자", email: "buyer@brook-demo.com", role: "user" },
    { name: "구매자2", email: "buyer2@brook-demo.com", role: "user" },
    { name: "판매자", email: "seller@brook-demo.com", role: "user" },
    { name: "관리자", email: "admin@brook-demo.com", role: "admin" },
  ];
  const extraSpecs = KOREAN_NAMES.map((name, i) => ({
    name, email: `user${i + 1}@brook-demo.com`, role: "user",
  }));

  const users = await User.insertMany(
    [...demoSpecs, ...extraSpecs].map((u) => ({ ...u, password: hash }))
  );
  console.log(`유저 ${users.length}명 생성`);

  const sellerPool = users.filter((u) => u.role === "user");
  const buyerPool = users.filter((u) => u.role === "user");

  const products = [];
  const bids = [];
  const reviews = [];
  const dealCount = new Map(); // sellerId -> { completed, total, cancelled }

  const addDeal = (sellerId, field) => {
    const k = sellerId.toString();
    const cur = dealCount.get(k) || { completed: 0, total: 0, cancelled: 0 };
    cur[field] += 1;
    dealCount.set(k, cur);
  };

  let imgSeed = 1;
  for (const category of CATEGORIES) {
    const names = PRODUCT_NAMES[category] || ["상품"];
    for (const title of names) {
      const seller = pick(sellerPool);
      const saleType = pickWeighted([["fixed", 6], ["auction", 4]]);
      const basePrice = rand(1, 40) * 5000; // 5천 ~ 20만
      const images = [img(imgSeed++), img(imgSeed++)];
      const views = rand(3, 600);
      const createdAt = daysAgo(rand(1, 150));

      if (saleType === "fixed") {
        const status = pickWeighted([["available", 5], ["reserved", 1], ["sold", 4]]);
        const doc = {
          seller: seller._id, title, description: `${title} 판매합니다. 상태 좋습니다.`,
          category, images, saleType: "fixed", fixedPrice: basePrice,
          fixedStatus: status, views, createdAt,
        };
        if (status === "sold") {
          const buyer = pick(buyerPool.filter((b) => !b._id.equals(seller._id)));
          doc.buyer = buyer._id;
          doc.soldAt = daysAgo(rand(1, 120));
          addDeal(seller._id, "completed"); addDeal(seller._id, "total");
          doc._buyerForReview = buyer._id;
        } else if (status === "reserved") {
          const buyer = pick(buyerPool.filter((b) => !b._id.equals(seller._id)));
          doc.buyer = buyer._id; doc.reservedAt = daysAgo(rand(1, 10));
          addDeal(seller._id, "total");
        }
        products.push(doc);
      } else {
        const status = pickWeighted([["pending", 2], ["live", 2], ["ended", 6]]);
        const startPrice = basePrice;
        const doc = {
          seller: seller._id, title, description: `${title} 경매 진행합니다.`,
          category, images, saleType: "auction", startPrice, currentPrice: startPrice,
          auctionStatus: status, views, createdAt,
          bidTiers: [],
        };
        if (status === "live") {
          doc.startTime = daysAgo(0);
          doc.endTime = new Date(Date.now() + rand(1, 48) * 60 * 60 * 1000);
          doc._makeBids = rand(2, 6);
        } else if (status === "ended") {
          doc.startTime = daysAgo(rand(5, 100));
          doc.endTime = daysAgo(rand(1, 100));
          const confirmed = Math.random() < 0.7;
          doc._makeBids = rand(2, 8);
          doc._ended = true;
          doc._confirmed = confirmed;
          addDeal(seller._id, "total");
          if (confirmed) { doc.auctionTradeConfirmed = true; doc.soldAt = doc.endTime; addDeal(seller._id, "completed"); }
        }
        products.push(doc);
      }
    }
  }

  const created = await Product.insertMany(products);
  console.log(`상품 ${created.length}개 생성`);

  // 경매 입찰/낙찰자 + 후기 생성
  for (let i = 0; i < created.length; i++) {
    const p = created[i];
    const spec = products[i];

    if (spec._makeBids) {
      const bidders = buyerPool.filter((b) => !b._id.equals(p.seller));
      let price = p.startPrice;
      let lastBidder = null;
      const n = spec._makeBids;
      for (let j = 0; j < n; j++) {
        price += rand(1, 4) * 5000;
        lastBidder = pick(bidders);
        bids.push({ product: p._id, bidder: lastBidder._id, amount: price, createdAt: daysAgo(rand(1, 5)) });
      }
      p.currentPrice = price;
      if (spec._ended && lastBidder) p.winner = lastBidder._id;
      await Product.updateOne({ _id: p._id }, { currentPrice: price, ...(p.winner ? { winner: p.winner } : {}) });

      // 낙찰+거래완료된 경매 → 후기
      if (spec._confirmed && lastBidder) {
        reviews.push({ product: p._id, reviewer: lastBidder._id, reviewee: p.seller, rating: pickWeighted([[5, 5], [4, 3], [3, 1]]), comment: pick(REVIEW_COMMENTS) });
      }
    }

    // 즉시구매 판매완료 → 후기
    if (spec._buyerForReview) {
      reviews.push({ product: p._id, reviewer: spec._buyerForReview, reviewee: p.seller, rating: pickWeighted([[5, 5], [4, 3], [3, 1]]), comment: pick(REVIEW_COMMENTS) });
    }
  }

  await Bid.insertMany(bids);
  await Review.insertMany(reviews);
  console.log(`입찰 ${bids.length}건, 후기 ${reviews.length}건 생성`);

  // 거래 카운터 반영
  for (const [sellerId, c] of dealCount.entries()) {
    await User.updateOne({ _id: sellerId }, { completedDeals: c.completed, totalDeals: c.total, cancelledDeals: c.cancelled });
  }

  // 인기 검색어
  await SearchKeyword.insertMany(POPULAR_KEYWORDS.map(([keyword, count]) => ({ keyword, count })));
  console.log(`인기 검색어 ${POPULAR_KEYWORDS.length}개 생성`);

  // 브룩 지수 재계산
  console.log("브룩 지수 재계산 중...");
  for (const u of sellerPool) {
    await recalculateBrookScore(u._id);
  }

  console.log("\n✅ 시드 완료!");
  console.log("데모 계정: buyer@/buyer2@/seller@/admin@brook-demo.com (비번 Brook1234)");
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("시드 실패:", err);
  process.exit(1);
});
