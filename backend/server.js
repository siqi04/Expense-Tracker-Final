// =======================
// Database Configuration with Auto-Creation
// =======================
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: process.env.DB_SSL === 'true' ? { 
      rejectUnauthorized: true,
      ca: process.env.DB_CA_CERT
    } : undefined
  });
  
  // Database initialization function
  const initializeDatabase = async () => {
    const conn = await pool.getConnection();
    try {
      // Create database if not exists
      await conn.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
      
      // Switch to the database
      await conn.query(`USE ${process.env.DB_NAME}`);
      
      // Create expenses table if not exists
      await conn.query(`
        CREATE TABLE IF NOT EXISTS expenses (
          id INT AUTO_INCREMENT PRIMARY KEY,
          description VARCHAR(255) NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          category VARCHAR(50) DEFAULT 'Other',
          date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      
      console.log('✅ Database and tables initialized');
    } catch (err) {
      console.error('❌ Database initialization failed:', err);
      throw err;
    } finally {
      conn.release();
    }
  };
  
  // Test and initialize database on startup
  (async () => {
    try {
      await initializeDatabase();
      
      // Now create a new pool with the specific database
      pool.config.connectionConfig.database = process.env.DB_NAME;
      
      const conn = await pool.getConnection();
      console.log('✅ Database connection established');
      conn.release();
    } catch (err) {
      console.error('❌ Database connection failed:', err.message);
      process.exit(1);
    }
  })();