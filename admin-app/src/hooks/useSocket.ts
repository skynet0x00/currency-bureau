import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

let _socket: Socket | null = null;

function getSocket(): Socket {
  if (!_socket) {
    _socket = io('http://localhost:3001', { transports: ['websocket', 'polling'] });
  }
  return _socket;
}

export function useSocket() {
  return useRef(getSocket()).current;
}

export function useSocketEvent<T>(event: string, handler: (data: T) => void) {
  const socket = useRef(getSocket()).current;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const cb = (data: T) => handlerRef.current(data);
    socket.on(event, cb);
    return () => { socket.off(event, cb); };
  }, [event, socket]);
}
