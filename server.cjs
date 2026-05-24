const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const webpush = require('web-push');
const cors = require('cors');

require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

const vapidPublic = process.env.VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails('mailto:contact@wakwak.app', vapidPublic, vapidPrivate);
}

const onlineUsers = new Map();
const pushSubscriptions = new Map();

app.post('/subscribe', (req, res) => {
  const { phoneNumber, subscription } = req.body;
  if (!phoneNumber || !subscription) {
    return res.status(400).json({ error: 'Missing data' });
  }
  pushSubscriptions.set(phoneNumber, subscription);
  console.log(`Push subscription saved: ${phoneNumber}`);
  return res.status(201).json({ message: 'Subscription saved' });
});

app.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidPublic || '' });
});

app.post('/reject-call', (req, res) => {
  const { callerPhone, targetPhone } = req.body;
  const callerSocketId = onlineUsers.get(callerPhone);
  if (callerSocketId) {
    io.to(callerSocketId).emit('call_rejected', { by: targetPhone });
  }
  res.json({ ok: true });
});

io.on('connection', (socket) => {
  socket.on('register_user', (phoneNumber) => {
    if (!phoneNumber) return;
    onlineUsers.set(phoneNumber, socket.id);
    socket.data.phoneNumber = phoneNumber;
    console.log(`Online: ${phoneNumber}`);
    io.emit('user_status_change', { phoneNumber, status: 'online' });
  });

  socket.on('call_user', async ({ callerPhone, targetPhone, callerName }) => {
    const targetSocketId = onlineUsers.get(targetPhone);

    if (targetSocketId) {
      io.to(targetSocketId).emit('incoming_call', {
        callerPhone,
        callerName: callerName || callerPhone,
        targetPhone,
        timestamp: Date.now(),
      });
      return;
    }

    const subscription = pushSubscriptions.get(targetPhone);
    if (subscription && vapidPublic && vapidPrivate) {
      const apiBase = process.env.WAKWAK_API_URL || `http://localhost:${process.env.PORT || 3001}`;
      const payload = JSON.stringify({
        type: 'incoming_call',
        callerPhone,
        callerName: callerName || callerPhone,
        targetPhone,
        timestamp: Date.now(),
        url: `/?action=accept_call&from=${encodeURIComponent(callerPhone)}`,
        apiBase,
      });
      try {
        await webpush.sendNotification(subscription, payload);
        console.log(`Push sent to offline user: ${targetPhone}`);
      } catch (err) {
        console.error('Push error:', err);
        if (err.statusCode === 410) {
          pushSubscriptions.delete(targetPhone);
        }
        socket.emit('call_failed', {
          reason: 'user_unreachable',
          targetPhone,
        });
      }
      return;
    }

    socket.emit('call_failed', {
      reason: 'user_unreachable',
      targetPhone,
    });
  });

  socket.on('accept_call', ({ callerPhone, targetPhone }) => {
    const callerSocketId = onlineUsers.get(callerPhone);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call_accepted', {
        by: targetPhone,
        timestamp: Date.now(),
      });
      io.emit('user_status_change', { phoneNumber: callerPhone, status: 'busy' });
      io.emit('user_status_change', { phoneNumber: targetPhone, status: 'busy' });
    }
  });

  socket.on('reject_call', ({ callerPhone, targetPhone }) => {
    const callerSocketId = onlineUsers.get(callerPhone);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call_rejected', { by: targetPhone });
    }
  });

  socket.on('voice_text', ({ callerPhone, targetPhone, text }) => {
    const targetSocketId = onlineUsers.get(targetPhone);
    if (targetSocketId) {
      io.to(targetSocketId).emit('receive_voice_text', {
        from: callerPhone,
        text,
        timestamp: Date.now(),
      });
    }
  });

  socket.on('sign_text', ({ callerPhone, targetPhone, text }) => {
    const targetSocketId = onlineUsers.get(targetPhone);
    if (targetSocketId) {
      io.to(targetSocketId).emit('receive_sign_text', {
        from: callerPhone,
        text,
        timestamp: Date.now(),
      });
    }
  });

  socket.on('end_call', ({ callerPhone, targetPhone }) => {
    const peerPhone = socket.data.phoneNumber === callerPhone ? targetPhone : callerPhone;
    const peerSocket = onlineUsers.get(peerPhone);
    if (peerSocket) {
      io.to(peerSocket).emit('call_ended', { by: socket.data.phoneNumber });
    }
    io.emit('user_status_change', { phoneNumber: callerPhone, status: 'online' });
    io.emit('user_status_change', { phoneNumber: targetPhone, status: 'online' });
  });

  socket.on('call_timeout', ({ callerPhone, targetPhone }) => {
    const targetSocketId = onlineUsers.get(targetPhone);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call_cancelled', { by: callerPhone });
    }
    io.emit('user_status_change', { phoneNumber: callerPhone, status: 'online' });
  });

  socket.on('disconnect', () => {
    const phone = socket.data.phoneNumber;
    if (phone) {
      onlineUsers.delete(phone);
      io.emit('user_status_change', { phoneNumber: phone, status: 'offline' });
      console.log(`Offline: ${phone}`);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`WakWak server running on port ${PORT}`);
});
