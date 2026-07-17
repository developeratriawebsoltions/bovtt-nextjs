// app/api/sample-messages/route.ts
import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { RowDataPacket } from 'mysql2';
export async function GET() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT || '3306'),
    });
    
    // Get last 10 messages
    const [messages] = await connection.execute<RowDataPacket[]>(`
  SELECT id, phone, message, type, direction, created_at 
  FROM \`messages-new\` 
  ORDER BY id DESC 
  LIMIT 10
`);
    
    await connection.end();
    
    return NextResponse.json({
      success: true,
      messages: messages,
      count: messages.length
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}