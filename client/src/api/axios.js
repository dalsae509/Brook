import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // refresh 엔드포인트 자체가 401이면 로그아웃
    if (original.url === "/api/auth/refresh") {
      const { default: useAuthStore } = await import("../store/authStore.js");
      useAuthStore.getState().logout();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return axiosInstance(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem("refreshToken");

    if (!refreshToken) {
      isRefreshing = false;
      const { default: useAuthStore } = await import("../store/authStore.js");
      useAuthStore.getState().logout();
      return Promise.reject(error);
    }

    try {
      const res = await axiosInstance.post("/api/auth/refresh", { refreshToken });
      const { token: newToken, refreshToken: newRefreshToken } = res.data;

      const { default: useAuthStore } = await import("../store/authStore.js");
      useAuthStore.getState().setToken({ token: newToken, refreshToken: newRefreshToken });

      original.headers.Authorization = `Bearer ${newToken}`;
      processQueue(null, newToken);
      return axiosInstance(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      const { default: useAuthStore } = await import("../store/authStore.js");
      useAuthStore.getState().logout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default axiosInstance;