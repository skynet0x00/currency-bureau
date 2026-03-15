import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

let _socket: Socket | null = null;

function getSocket(): Socket {
  if (!_socket) {
    _socket = io('http://localhost:3001', { transports: ['websocket', 'polling'] });
  }
  return _socket;
}

export function useSocket(onRatesUpdated?: (data: any) => void) {
  const socketRef = useRef(getSocket());

  useEffect(() => {
    const socket = socketRef.current;
    if (onRatesUpdated) {
      socket.on('rates:updated', onRatesUpdated);
      return () => { socket.off('rates:updated', onRatesUpdated); };
    }
  }, [onRatesUpdated]);

  return socketRef.current;
}
