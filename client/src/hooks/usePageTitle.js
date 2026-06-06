import { useEffect } from "react";

const DEFAULT_TITLE = "Brook — 실시간 중고 경매 마켓플레이스";

// 페이지별 문서 제목 설정 (SEO · 스크린리더 · 브라우저 탭)
export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | Brook` : DEFAULT_TITLE;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title]);
}
