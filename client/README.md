# Brook — 클라이언트

React + Vite 기반 프론트엔드입니다. 루트 [README.md](../README.md)에서 전체 프로젝트 설명을 확인하세요.

## 실행

```bash
npm install
npm run dev   # http://localhost:5173
npm run build # 프로덕션 빌드
npm run lint  # ESLint
```

## 환경 변수

```env
VITE_API_BASE_URL=http://localhost:5000
```

## 주요 구조

```
src/
├── api/        # Axios 인스턴스 (JWT 인터셉터)
├── components/ # 공통 컴포넌트 (Header, NotificationBell 등)
├── layouts/    # MainLayout
├── pages/      # 페이지 컴포넌트
├── socket/     # Socket.io 싱글턴
├── store/      # Zustand 스토어 (auth, notification)
└── utils/      # bidUnit, categories
```
