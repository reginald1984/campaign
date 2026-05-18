const express = require('express');
const dotenv = require('dotenv');
const fs = require('fs');
const http = require('http');
const path = require('path');
const morgan = require('morgan');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Server } = require("socket.io");
const { ALLOWED_ORIGINS } = require('./utils/allowedOrigins');
const seedAdmin = require('./scripts/seed-admin');
// const userRoutes=require('./routes/userRoutes')
// const eventRoutes=require('./routes/eventRoutes')
// const postRoutes=require('./routes/postRoutes')
// const subscribeRoutes=require('./routes/subscribeRoutes')
// const volunteerRoutes=require('./routes/volunteerRoutes')
// const messageRoutes=require('./routes/messageRoutes')
// const commentRoutes=require('./routes/commentRoutes')
// Load environment variables
dotenv.config();

// Import custom modules
const connectDB = require('./config/dbConnect');
const logger = require('./config/logger.config');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8280;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Database connection
connectDB();
seedAdmin();

// Allowed origins configuration
const allowedOrigins = Array.isArray(ALLOWED_ORIGINS) 
  ? ALLOWED_ORIGINS 
  : [
      'http://localhost:3000', 
      'http://127.0.0.1:3000',
      'http://localhost:8280', 
      'http://127.0.0.1:8280',
      'https://campaign-22qf.onrender.com',
      'http://cheapcallme.com',
    'https://cheapcallme.com'
    ];

console.log('🔄 Allowed CORS origins:', allowedOrigins);

// =============================================
// CORS CONFIGURATION (No cookies)
// =============================================
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowed => {
      return origin === allowed || 
             origin.includes('localhost') ||
             origin.includes('127.0.0.1') ||
             origin.includes('https://campaign-22qf.onrender.com') ||
          origin.includes('https://cheapcallme.com')||
           origin.includes('http://cheapcallme.com');
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked for origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Accept',
    'Origin'
  ],
  exposedHeaders: [
    'Content-Length',
    'Content-Disposition'
  ],
  credentials: false, // No credentials needed since we're not using cookies
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400
}));

// Handle preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 
    'Content-Type, Authorization, Accept, Origin');
  res.status(204).send();
});

// =============================================
// SECURITY MIDDLEWARE
// =============================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https:", "http:", "ws:", "wss:"],
    },
  }
}));

app.use(mongoSanitize());
app.use(compression());

// =============================================
// REQUEST PARSING
// =============================================
app.use(bodyParser.urlencoded({ 
  extended: true, 
  limit: '50mb',
  parameterLimit: 100000
}));
app.use(express.json({ 
  limit: '50mb',
  type: ['application/json', 'text/plain']
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb',
  parameterLimit: 100000
}));

// =============================================
// LOGGING MIDDLEWARE
// =============================================
app.use((req, res, next) => {
  console.log('=== REQUEST DEBUG ===');
  console.log('📨 Headers:', {
    'user-agent': req.headers['user-agent'],
    'origin': req.headers.origin,
    'authorization': req.headers.authorization ? 'Bearer [TOKEN]' : 'Missing',
    'accept': req.headers.accept,
    'content-type': req.headers['content-type']
  });
  console.log('🌐 Method & URL:', req.method, req.originalUrl);
  console.log('===================');
  next();
});

if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { 
    stream: logger.stream || process.stdout 
  }));
}

// =============================================
// SOCKET.IO INITIALIZATION
// =============================================
const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      if (!origin) return callback(null, true);
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "PUT"],
    allowedHeaders: [
      'Content-Type', 
      'Authorization',
      'Origin'
    ],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

logger.info('Socket.IO server initialized successfully');

// =============================================
// ROUTES LOADING
// =============================================
const loadRoutes = async () => {
  const files = await fs.promises.readdir('./routes');
  for (const routeFile of files) {
    if (routeFile.endsWith('.js')) {
      try {
        const route = require(`./routes/${routeFile}`);
        app.use('/api/v1', route);
        console.log(`✅ Loaded route: /api/v1/${routeFile.replace('.js', '')}`);
      } catch (error) {
        console.error(`❌ Failed to load route ${routeFile}:`, error.message);
      }
    }
  }
};

app.use((req, res, next) => {
  console.log('🔍 GLOBAL CHECK - Path:', req.path, 'Method:', req.method);
  next();
});
loadRoutes();

// =============================================
// STATIC FILES
// =============================================
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, path) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
  }
}));

// =============================================
// GLOBAL ERROR HANDLER
// =============================================
app.use((error, req, res, next) => {
  console.log('❌ Global Error Handler:', error.message);
  
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  
  if (req.file) {
    fs.unlink(req.file.path, err => {
      if (err) logger.error(`Error deleting file: ${err.message}`, { stack: err.stack });
    });
  }
  
  if (res.headerSent) {
    return next(error);
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'An unexpected error occurred';
  
  logger.error(`${statusCode} - ${message}`, { 
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    stack: error.stack,
    userAgent: req.headers['user-agent']
  });
  
  if (message.includes('CORS')) {
    return res.status(403).json({
      error: {
        status: 403,
        message: 'CORS policy violation',
        details: 'Request blocked by CORS policy',
        allowedOrigins: allowedOrigins,
        yourOrigin: req.headers.origin
      }
    });
  }
  
  res.status(statusCode).json({
    error: {
      status: statusCode,
      message: message,
      stack: NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }
  });
});

// =============================================
// PROCESS ERROR HANDLERS
// =============================================
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...', { 
    error: err.message,
    stack: err.stack 
  });
  console.error('💥 Uncaught Exception:', err);
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! Shutting down...', { 
    error: err.message,
    stack: err.stack 
  });
  console.error('💥 Unhandled Rejection:', err);
  server.close(() => setTimeout(() => process.exit(1), 1000));
});

process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
  });
});

// =============================================
// START SERVER
// =============================================
server.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Server started successfully');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`🌐 Listening on: 0.0.0.0 (all interfaces)`);
  console.log(`✅ CORS Enabled for:`, allowedOrigins);
  console.log(`🔐 Authentication: JWT Tokens only (no cookies)`);
  logger.info(`Server running on port ${PORT} in ${NODE_ENV} mode`);
});
