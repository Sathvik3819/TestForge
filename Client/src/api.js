import axios from "axios";

function getApiBaseUrl() {
  const explicit = import.meta.env.VITE_API_URL;
  if (explicit) {
    return explicit;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`;
  }

  return "/api";
}

const API = axios.create({
  baseURL: getApiBaseUrl(),
});

// attach token automatically
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers["x-auth-token"] = token;
  }
  return config;
});

export default API;
