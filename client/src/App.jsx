import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import MainLayout from "./layouts/MainLayout";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import CreateProductPage from "./pages/CreateProductPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import MyPage from "./pages/MyPage";
import ChatListPage from "./pages/ChatListPage";
import ChatRoomPage from "./pages/ChatRoomPage";
import SellerProfilePage from "./pages/SellerProfilePage";
import AdminPage from "./pages/AdminPage";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFoundPage from "./pages/NotFoundPage";
import WantedListPage from "./pages/WantedListPage";
import WantedDetailPage from "./pages/WantedDetailPage";
import CreateWantedPage from "./pages/CreateWantedPage";
import useAuthStore from "./store/authStore";
import useNotificationStore from "./store/notificationStore";
import socket from "./socket/socket";

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
    </BrowserRouter>
  );
}

export default App;