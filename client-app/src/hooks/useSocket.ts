import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

export interface RatesUpdatedPayload {
  rates: unknown[];
}

let _socket: Socket | null = null;

function getSocket(): Socket {
  if (!_socket) {
    _socket = io('http://localhost:3001', { transports: ['websocket', 'polling'] });
  }
  return _socket;
}

export function useSocket(onRatesUpdated?: (data: RatesUpdatedPayload) => void) {
  useEffect(() => {
    const socket = getSocket();
    if (onRatesUpdated) {
      socket.on('rates:updated', onRatesUpdated);
      return () => { socket.off('rates:updated', onRatesUpdated); };
    }
  }, [onRatesUpdated]);

  return getSocket();
}
