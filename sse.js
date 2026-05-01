/**
 * SSE Manager — Server-Sent Events for real-time player updates
 * In-memory Map with Set per player (supports multiple tabs/devices)
 */

const clients = new Map(); // uniqueId -> Set<res>

function addClient(uniqueId, res) {
  if (!clients.has(uniqueId)) {
    clients.set(uniqueId, new Set());
  }
  clients.get(uniqueId).add(res);

  // Clean up on close
  res.on('close', () => {
    const set = clients.get(uniqueId);
    if (set) {
      set.delete(res);
      if (set.size === 0) {
        clients.delete(uniqueId);
      }
    }
  });
}

function sendEvent(uniqueId, eventName, data) {
  const set = clients.get(uniqueId);
  if (!set) return;
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
      if (typeof res.flush === 'function') res.flush();
    } catch (err) {
      // Client disconnected — will be cleaned up on close
    }
  }
}

function getClientCount() {
  let total = 0;
  for (const set of clients.values()) {
    total += set.size;
  }
  return total;
}

// 15-second heartbeat to keep connections alive (better for proxies/Cloudflare)
setInterval(() => {
  for (const [, set] of clients) {
    for (const res of set) {
      try {
        res.write(': heartbeat\n\n');
        if (typeof res.flush === 'function') res.flush();
      } catch (err) {
        // Will be cleaned up on close
      }
    }
  }
}, 15000);

module.exports = {
  addClient,
  sendEvent,
  getClientCount,
};
