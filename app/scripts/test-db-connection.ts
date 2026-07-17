// scripts/test-db-connection.ts
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: '.env.local' });

async function testConnection() {
  console.log('Testing database connection...');
  console.log(`Host: ${process.env.DB_HOST}`);
  console.log(`User: ${process.env.DB_USER}`);
  console.log(`Database: ${process.env.DB_NAME}`);
  
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT || '3306'),
    });
    
    console.log('✅ Connected successfully!');
    
    // Test query
    const [rows] = await connection.query('SELECT NOW() as current_time, DATABASE() as database_name');
    console.log('Query result:', rows);
    
    await connection.end();
    console.log('✅ Connection closed.');
  } catch (error) {
    console.error('❌ Connection failed:', error);
  }
}

testConnection();