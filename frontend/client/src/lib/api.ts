import axios, { AxiosError } from "axios";

// ================= AXIOS INSTANCE =================

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  withCredentials: true,
  timeout: 10000,
});

// ================= REQUEST INTERCEPTOR =================

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ================= RESPONSE INTERCEPTOR =================

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    if (!error.response) {
      return Promise.reject(new Error("Network error. Please try again."));
    }

    const status = error.response.status;

    // 🔐 Auto logout on 401
    if (status === 401) {
  const token = localStorage.getItem("token");

  // 🔥 ONLY logout if user was already logged in
  if (token) {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }
}

    const message =
      error.response.data?.error ||
      error.response.data?.message ||
      "Something went wrong";

    return Promise.reject(new Error(message));
  }
);

// ================= TYPED HELPERS =================

// 🔥 THESE FIX YOUR TYPESCRIPT ISSUE

export const get = async <T>(
  url: string,
  config?: any
): Promise<T> => {
  const res = await api.get<T>(url, config);
  return res.data;
};

export const post = async <T>(url: string, data?: any): Promise<T> => {
  const res = await api.post<T>(url, data);
  return res.data;
};

export const put = async <T>(url: string, data?: any): Promise<T> => {
  const res = await api.put<T>(url, data);
  return res.data;
};

export const del = async <T>(url: string): Promise<T> => {
  const res = await api.delete<T>(url);
  return res.data;
};

export default api;