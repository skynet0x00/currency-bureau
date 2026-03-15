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
  return getSocket();
}

export function useSocketEvent<T>(event: string, handler: (data: T) => void) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const socket = getSocket();
    const cb = (data: T) => handlerRef.current(data);
    socket.on(event, cb);
    return () => { socket.off(event, cb); };
  }, [event]);
}
