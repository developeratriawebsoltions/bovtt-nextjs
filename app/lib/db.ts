// lib/db.ts
import mysql from 'mysql2/promise';

// Create connection pool for remote database
const pool = mysql.createPool({
  host: process.env.DB_HOST,           // Remote server IP or domain
  user: process.env.DB_USER,            // Database username
  password: process.env.DB_PASSWORD,    // Database password
  database: process.env.DB_NAME,        // Database name
  port: parseInt(process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 10,                  // Adjust based on your needs
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // SSL configuration if required by your remote server
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : undefined,
  // Connection timeout
  connectTimeout: 60000,
  // Idle timeout
  idleTimeout: 60000,
});

// Test connection on startup
export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully!');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

export default pool;