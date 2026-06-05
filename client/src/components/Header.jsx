import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axiosInstance from "../api/axios";
import useAuthStore from "../store/authStore";
import NotificationBell from "./NotificationBell";

function Header() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    try {
      if (refreshToken) {
        await axiosInstance.post("/api/auth/logout", { refreshToken });
      }
    } catch {
      // 서버 오류여도 로컬 로그아웃 진행
    } finally {
      logout();
      navigate("/login");
    }
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="text-2xl font-bold text-slate-800">
          Brook
        </Link>

        {/* 데스크탑 네비게이션 */}
        <nav className="hidden md:flex items-center gap-4">
          <Link to="/" className="text-slate-700 hover:text-slate-900">
            홈
          </Link>
          <Link to="/wanted" className="text-slate-700 hover:text-slate-900">
            삽니다
          </Link>

          {user && (
            <>
              <Link to="/products/new" className="text-slate-700 hover:text-slate-900">
                상품 등록
              </Link>
              <Link to="/chats" className="text-slate-700 hover:text-slate-900">
                채팅
              </Link>
              <Link to="/mypage" className="text-slate-700 hover:text-slate-900">
                마이페이지
              </Link>
            </>
          )}

          {user?.role === "admin" && (
            <Link to="/admin" className="text-red-600 hover:text-red-800 font-medium text-sm">
              관리자
            </Link>
          )}

          {user && <NotificationBell />}

          {!user ? (
            <>
              <Link to="/login" className="text-slate-700 hover:text-slate-900">
                로그인
              </Link>
              <Link to="/register" className="text-slate-700 hover:text-slate-900">
                회원가입
              </Link>
            </>
          ) : (
            <>
              <span className="text-sm text-slate-600">{user.name}님</span>
              <button
                onClick={handleLogout}
                className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700"
              >
                로그아웃
              </button>
            </>
          )}
        </nav>

        {/* 모바일 오른쪽 아이콘들 */}
        <div className="flex md:hidden items-center gap-3">
          {user && <NotificationBell />}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="메뉴"
          >
            {menuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 모바일 드롭다운 메뉴 */}
      {menuOpen && (
        <div className="md:hidden border-t bg-white px-4 py-3 space-y-1">
          <Link to="/" onClick={closeMenu} className="block py-2 text-slate-700 hover:text-slate-900">
            홈
          </Link>
          <Link to="/wanted" onClick={closeMenu} className="block py-2 text-slate-700 hover:text-slate-900">
            삽니다
          </Link>

          {user && (
            <>
              <Link to="/products/new" onClick={closeMenu} className="block py-2 text-slate-700 hover:text-slate-900">
                상품 등록
              </Link>
              <Link to="/chats" onClick={closeMenu} className="block py-2 text-slate-700 hover:text-slate-900">
                채팅
              </Link>
              <Link to="/mypage" onClick={closeMenu} className="block py-2 text-slate-700 hover:text-slate-900">
                마이페이지
              </Link>
            </>
          )}

          {user?.role === "admin" && (
            <Link to="/admin" onClick={closeMenu} className="block py-2 text-red-600 hover:text-red-800 font-medium">
              관리자
            </Link>
          )}

          <div className="border-t pt-2 mt-2">
            {!user ? (
              <div className="flex gap-3">
                <Link to="/login" onClick={closeMenu} className="flex-1 text-center py-2 border rounded-lg text-slate-700 hover:bg-slate-50">
                  로그인
                </Link>
                <Link to="/register" onClick={closeMenu} className="flex-1 text-center py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
                  회원가입
                </Link>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{user.name}님</span>
                <button
                  onClick={() => { handleLogout(); closeMenu(); }}
                  className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 text-sm"
                >
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export default Header;
