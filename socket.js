/**
 * socket.js — Socket.IO manager for real-time player updates
 */
let io;

function init(server) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    const uniqueId = socket.handshake.query.uniqueId;
    if (uniqueId) {
      const room = uniqueId.toUpperCase();
      socket.join(room);
      console.log(`Socket: Player ${room} connected (Socket ID: ${socket.id})`);
    }

    socket.on('disconnect', () => {
      // Automatic cleanup by Socket.IO
    });
  });

  return io;
}

function sendEvent(uniqueId, eventName, data) {
  if (!io) return;
  const room = uniqueId.toUpperCase();
  console.log(`Socket: Broadcasting ${eventName} to room ${room}`);
  io.to(room).emit(eventName, data);
}

function getClientCount() {
  if (!io) return 0;
  return io.engine.clientsCount;
}

module.exports = {
  init,
  sendEvent,
  getClientCount,
};