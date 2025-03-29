require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const xss = require('xss-clean');
const hpp = require('hpp');
const app = express();

// =======================
// Security Middleware
// =======================
app.use(helmet());
app.use(xss());
app.use(hpp());

// Enhanced CORS Configuration
const allowedOrigins = [
  'http://localhost:3000', // React dev server
  'http://127.0.0.1:3000', // Alternative localhost
  process.env.FRONTEND_URL // Your production frontend URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
}));

// Handle preflight requests
app.options('*', cors());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later'
});
app.use('/api/', limiter);

// Body Parser
app.use(express.json({ limit: '10kb' }));

// =======================
// Database Configuration
// =======================
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.DB_SSL === 'true' ? { 
    rejectUnauthorized: true,
    ca: process.env.DB_CA_CERT // Add your CA cert if needed
  } : undefined
});

// Test database connection on startup
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Database connection established');
    conn.release();
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }
})();

// =======================
// API Routes
// =======================

// Health Check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ 
      status: 'healthy',
      database: 'connected',
      uptime: process.uptime()
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message 
    });
  }
});

// Enhanced CRUD Operations with Transactions
app.get('/api/expenses', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, description, amount, category, 
             DATE_FORMAT(date, '%Y-%m-%d %H:%i:%s') as date 
      FROM expenses 
      ORDER BY date DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('GET /api/expenses error:', err);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

app.post('/api/expenses', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    const { description, amount, category } = req.body;
    
    // Input validation
    if (!description?.trim()) {
      throw new Error('Description is required');
    }
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      throw new Error('Amount must be a positive number');
    }
    if (!category?.trim()) {
      throw new Error('Category is required');
    }

    const [result] = await conn.query(
      'INSERT INTO expenses (description, amount, category) VALUES (?, ?, ?)',
      [description.trim(), parseFloat(amount), category.trim()]
    );
    
    const [newExpense] = await conn.query(
      `SELECT id, description, amount, category, 
              DATE_FORMAT(date, '%Y-%m-%d %H:%i:%s') as date 
       FROM expenses WHERE id = ?`, 
      [result.insertId]
    );
    
    await conn.commit();
    res.status(201).json(newExpense[0]);
  } catch (err) {
    await conn.rollback();
    console.error('POST /api/expenses error:', err);
    res.status(400).json({ error: err.message || 'Failed to create expense' });
  } finally {
    conn.release();
  }
});

// ... (put and delete endpoints with similar transaction handling)

// =======================
// Error Handling
// =======================
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// =======================
// Server Startup
// =======================
const PORT = process.env.PORT || 5111;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔒 CORS allowed for: ${allowedOrigins.join(', ')}`);
});

// Graceful Shutdown
const shutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  try {
    await new Promise(resolve => server.close(resolve));
    await pool.end();
    console.log('✅ Server and database connections closed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);