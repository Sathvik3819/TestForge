import { io } from "socket.io-client";
import API from "./api";

function getSocketBaseUrl() {
  const explicit = import.meta.env.VITE_SOCKET_URL;
  if (explicit) return explicit;

  const apiBase = API.defaults.baseURL || "/api";
  return apiBase.replace(/\/api\/?$/, "");
}

export function createAuthedSocket() {
  const token = localStorage.getItem("token");
  return io(getSocketBaseUrl(), {
    transports: ["websocket"],
    auth: { token },
  });
}
