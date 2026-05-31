const jwt = require('jsonwebtoken');

const clients = new Map();
let nextClientId = 1;

const getToken = (req) => {
  const authHeader = req.header('Authorization') || '';
  return req.query.token || authHeader.replace(/^Bearer\s+/i, '') || '';
};

const getUserId = (req) => {
  const token = getToken(req);

  if (!token || !process.env.JWT_SECRET) {
    return null;
  }

  try {
    return jwt.verify(token, process.env.JWT_SECRET)?.id || null;
  } catch {
    return null;
  }
};

const sendEvent = (client, event, payload) => {
  if (!client?.res || client.res.destroyed) {
    return;
  }

  client.res.write(`event: ${event}\n`);
  client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const io = {
  handleConnection(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const clientId = nextClientId;
    nextClientId += 1;

    const client = {
      id: clientId,
      userId: getUserId(req),
      res
    };

    clients.set(clientId, client);
    res.write(': connected\n\n');

    const heartbeat = setInterval(() => {
      if (res.destroyed) {
        clearInterval(heartbeat);
        clients.delete(clientId);
        return;
      }

      res.write(': heartbeat\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(clientId);
    });
  },

  emit(event, payload) {
    clients.forEach((client) => sendEvent(client, event, payload));
  },

  toUser(userId) {
    const normalizedUserId = String(userId || '');

    return {
      emit(event, payload) {
        clients.forEach((client) => {
          if (String(client.userId || '') === normalizedUserId) {
            sendEvent(client, event, payload);
          }
        });
      }
    };
  }
};

module.exports = { io };
