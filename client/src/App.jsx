import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import MainLayout from "./layouts/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import useAuthStore from "./store/authStore";
import useNotificationStore from "./store/notificationStore";
import socket from "./socket/socket";

// 라우트 단위 코드 스플리팅 — 초기 번들 크기 축소
const HomePage = lazy(() => import("./pages/HomePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const CreateProductPage = lazy(() => import("./pages/CreateProductPage"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage"));
const MyPage = lazy(() => import("./pages/MyPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ChatListPage = lazy(() => import("./pages/ChatListPage"));
const ChatRoomPage = lazy(() => import("./pages/ChatRoomPage"));
const SellerProfilePage = lazy(() => import("./pages/SellerProfilePage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const WantedListPage = lazy(() => import("./pages/WantedListPage"));
const WantedDetailPage = lazy(() => import("./pages/WantedDetailPage"));
const CreateWantedPage = lazy(() => import("./pages/CreateWantedPage"));

function AdminRoute({ children }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <div className="p-8 text-center text-slate-500">접근 권한이 없습니다.</div>;
  return children;
}

function App() {
  const { user } = useAuthStore();
  const { addNotification } = useNotificationStore();

  useEffect(() => {
    if (!user) {
      socket.disconnect();
      return;
    }

    const token = localStorage.getItem("token");
    socket.auth = { token };
    socket.connect();

    const handleConnect = () => {
      socket.emit("user:join");
    };

    const handleNotification = (notification) => {
      addNotification(notification);
    };

    socket.on("connect", handleConnect);
    socket.on("notification:new", handleNotification);

    // 이미 연결되어 있으면 connect 이벤트가 발생하지 않으므로 직접 join
    if (socket.connected) {
      socket.emit("user:join");
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("notification:new", handleNotification);
    };
  }, [user, addNotification]);

  return (
    <BrowserRouter>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <ErrorBoundary>
      <Suspense fallback={<div className="text-center py-20 text-slate-400">불러오는 중...</div>}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/users/:userId" element={<SellerProfilePage />} />
          <Route path="/wanted" element={<WantedListPage />} />
          <Route path="/wanted/:id" element={<WantedDetailPage />} />

          <Route
            path="/products/new"
            element={
              <ProtectedRoute>
                <CreateProductPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/wanted/new"
            element={
              <ProtectedRoute>
                <CreateWantedPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/mypage"
            element={
              <ProtectedRoute>
                <MyPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/chats"
            element={
              <ProtectedRoute>
                <ChatListPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/chats/:chatId"
            element={
              <ProtectedRoute>
                <ChatRoomPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;