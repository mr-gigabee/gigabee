import { io, type Socket } from "socket.io-client";

const TOKEN_KEY = "gigabee-session-token";

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore in SSR / private browsing
  }
}

export function clearSessionToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

// Singleton socket for the /client namespace
let _socket: Socket | null = null;

/**
 * Returns the singleton /client socket, or null if no session token exists.
 * Reconnects with a fresh token if the stored token changed.
 */
export function getClientSocket(): Socket | null {
  const token = getSessionToken();
  if (!token) return null;

  if (_socket) {
    const prevToken = (_socket.auth as { token?: string }).token;
    if (prevToken === token) return _socket;
    // Token changed rebuild
    _socket.removeAllListeners();
    _socket.disconnect();
    _socket = null;
  }

  _socket = io("/client", {
    path: "/api/socket.io",
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 30_000,
    autoConnect: false,
  });

  return _socket;
}

/**
 * Connect the socket if a token exists. Returns the connected socket or null.
 */
export function connectSocket(): Socket | null {
  const socket = getClientSocket();
  if (!socket) return null;
  if (!socket.connected) socket.connect();
  return socket;
}

/** Disconnect and destroy the socket (e.g. on logout). */
export function disconnectSocket() {
  _socket?.removeAllListeners();
  _socket?.disconnect();
  _socket = null;
}
