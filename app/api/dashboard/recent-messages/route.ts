import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

export async function GET() {
  try {
    const [rows] = await pool.query(`
      SELECT id, phone, message, direction, created_at 
      FROM \`messages-new\` 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    return NextResponse.json({ success: true, messages: rows });
  } catch (error) {
    console.error('Error fetching recent messages:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch messages' }, { status: 500 });
  }
}