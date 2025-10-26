import axios from "axios";

const API_URL = 'http://127.0.0.1:3001';

const axiosClient = axios.create({
  baseURL: API_URL+"/api", // 👈 Cambia por tu endpoint real
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default axiosClient;
