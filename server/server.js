// Core Node.js modules
const path = require('path');
const http = require('http');
const fs = require('fs');

// Load environment variables first
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Verify required environment variables
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  process.exit(1);
}

// Third-party dependencies
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Application modules
const connectDB = require('./config/db');

const app = express();

// Create HTTP server for Socket.IO
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Authorization"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Middleware
app.use(express.json());

// CORS configuration
const allowedOrigins = [
  'https://botalsepaisa-2-0.onrender.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['set-cookie']
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Serve static files
const frontendPath = path.join(__dirname, '../docs');
app.use(express.static(frontendPath));

// Debug: Check if frontend directory exists
console.log('📁 Frontend path:', frontendPath);
if (fs.existsSync(frontendPath)) {
  console.log('✅ Frontend directory exists');
  const htmlFiles = fs.readdirSync(frontendPath).filter(f => f.endsWith('.html'));
  console.log('📋 HTML Files found:', htmlFiles);
} else {
  console.log('❌ Frontend directory not found at:', frontendPath);
}

// Make Socket.IO available in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Connect to MongoDB with error handling
connectDB().catch(err => {
  console.error('❌ Failed to connect to MongoDB:', err);
  process.exit(1);
});

// Make io global for socket events
global.io = io;

// API Routes
const userRoutes = require('./routes/userRoutes');
const qrRoutes = require('./routes/qrRoutes');

app.use('/api/users', userRoutes);
app.use('/api/qr', qrRoutes);

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'login.html'));
});

// Test route
app.get('/test', (req, res) => {
  res.json({
    message: 'BotalSePaisa Server Working with Mongoose!',
    timestamp: new Date(),
    database: 'MongoDB with Mongoose',
    frontend_path: frontendPath,
    available_routes: ['/', '/test', '/health', '/api/socket-status']
  });
});

// Socket.IO Authentication Middleware
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      console.log('⚠️ Socket connection attempt without token');
      socket.isAuthenticated = false;
      socket.userId = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    socket.userEmail = decoded.email;
    socket.isAuthenticated = true;

    console.log(`✅ Socket authenticated for user: ${decoded.id}`);
    next();

  } catch (error) {
    console.error('❌ Socket authentication error:', error.message);
    socket.isAuthenticated = false;
    socket.userId = null;
    next();
  }
});

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  const userId = socket.userId;
  const isAuth = socket.isAuthenticated;

  console.log(`🔌 Socket connected: ${socket.id} | User: ${userId || 'Anonymous'} | Auth: ${isAuth}`);

  if (isAuth && userId) {
    socket.join(`user_${userId}`);
    socket.join('authenticated_users');

    socket.emit('connection-status', {
      status: 'authenticated',
      message: 'Connected to real-time updates',
      userId: userId
    });

    console.log(`👤 User ${userId} joined their notification room`);

  } else {
    socket.join('anonymous_users');
    socket.emit('connection-status', {
      status: 'anonymous',
      message: 'Connected without authentication'
    });
  }

  // QR scan events
  socket.on('qr-scan-submitted', (data) => {
    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required for QR scanning' });
      return;
    }

    console.log(`📱 QR scan submitted by user ${socket.userId}:`, data);

    socket.to('admin_room').emit('admin-notification', {
      type: 'new-qr-scan',
      userId: socket.userId,
      data: data,
      timestamp: new Date().toISOString()
    });
  });

  // Join user room
  socket.on('join-user-room', (data) => {
    if (socket.isAuthenticated) {
      socket.join(`user_${socket.userId}`);
      socket.emit('room-joined', {
        room: `user_${socket.userId}`,
        message: 'Successfully joined user room'
      });
    }
  });

  // Ping/Pong
  socket.on('ping', (data) => {
    socket.emit('pong', {
      message: 'Server is alive!',
      timestamp: new Date().toISOString(),
      authenticated: socket.isAuthenticated,
      ...data
    });
  });

  // Disconnect
  socket.on('disconnect', (reason) => {
    console.log(`❌ Socket disconnected: ${socket.id} | User: ${userId || 'Anonymous'} | Reason: ${reason}`);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    connectedSockets: io.engine.clientsCount,
    uptime: process.uptime(),
    database: 'MongoDB with Mongoose',
    frontend_path: frontendPath
  });
});

// Socket status endpoint
app.get('/api/socket-status', (req, res) => {
  const rooms = [];
  io.sockets.adapter.rooms.forEach((value, key) => {
    if (!key.startsWith('/')) {
      rooms.push({
        room: key,
        clients: value.size
      });
    }
  });

  res.json({
    totalConnections: io.engine.clientsCount,
    rooms: rooms,
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 BotalSePaisa Server running on port ${PORT}`);
  console.log(`📡 Socket.IO enabled for real-time notifications`);
  console.log(`🔐 JWT Authentication configured`);
  console.log(`🗄️ Database: MongoDB with Mongoose`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Test endpoint: http://localhost:${PORT}/test`);
  console.log(`📁 Static files: ${frontendPath}`);

  if (fs.existsSync(frontendPath)) {
    const htmlFiles = fs.readdirSync(frontendPath).filter(f => f.endsWith('.html'));
    console.log(`📋 Available pages: ${htmlFiles.map(f => `/${f}`).join(', ')}`);
  }
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n🔄 ${signal} received, shutting down gracefully...`);

  io.emit('server-shutdown', {
    message: 'Server is shutting down for maintenance',
    timestamp: new Date().toISOString(),
    reconnect: true
  });

  setTimeout(() => {
    server.close(() => {
      console.log('✅ HTTP Server closed');

      io.close(() => {
        console.log('✅ Socket.IO Server closed');
        console.log('✅ Database connections closed');
        process.exit(0);
      });
    });
  }, 1000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, server, io };
