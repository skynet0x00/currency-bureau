import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { restockTill } from './services/tillService';

let _io: Server | null = null;

export function initSocket(server: HttpServer): Server {
  _io = new Server(server, {
    cors: {
      origin: [
        process.env.CORS_ORIGIN     ?? 'http://localhost:5173',
        process.env.ADMIN_ORIGIN    ?? 'http://localhost:5174',
      ],
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  _io.on('connection', (socket: Socket) => {
    console.log(`[ws] connected  ${socket.id}`);

    // Admin sends restock payload → update DB → broadcast till:updated
    socket.on('admin:restock', async (data: { currency: string; denominations: Record<string, number> }) => {
      try {
        await restockTill(data.currency.toUpperCase(), data.denominations);
        _io?.emit('till:updated', {
          currency: data.currency.toUpperCase(),
          denominations: data.denominations,
          timestamp: new Date().toISOString(),
        });
        console.log(`[ws] till restocked via socket: ${data.currency}`);
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[ws] disconnected ${socket.id}`);
    });
  });

  return _io;
}

export function getIo(): Server {
  if (!_io) throw new Error('Socket.io not initialized');
  return _io;
}

// Helpers used by route handlers to fire events
export function emitTransaction(tx: object) {
  _io?.emit('transaction:new', tx);
}

export function emitRatesUpdated(rates: object) {
  _io?.emit('rates:updated', rates);
}

export function emitTillUpdated(data: object) {
  _io?.emit('till:updated', data);
}
