// 앱 전역 설정 상수 — 흩어진 매직 넘버를 한곳에 모음

// 인증
export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL = "7d";
export const MAX_REFRESH_TOKENS = 5; // 동시 로그인 가능 기기 수
export const BCRYPT_SALT_ROUNDS = 10;

// 레이트 리밋
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15분
export const RATE_LIMIT_API_MAX = 200;
export const RATE_LIMIT_AUTH_MAX = 100;

// 거래 리마인더
export const TRADE_REMINDER_AFTER_MS = 3 * 24 * 60 * 60 * 1000; // 3일
export const TRADE_REMINDER_SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6시간

// 신고
export const REPORT_DUPLICATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7일
