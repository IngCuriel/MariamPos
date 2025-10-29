import axios from "axios";
  
 const axiosClient = axios.create({
  baseURL: '', // 👈 Cambia por tu endpoint real
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
 

export default axiosClient;
