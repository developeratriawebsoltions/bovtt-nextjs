// app/api/unread-count/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const phone = searchParams.get('phone');
    
    let query = `
      SELECT 
        phone,
        COUNT(*) as unread_count 
      FROM \`messages-new\` 
      WHERE direction = 'incoming' AND is_read = 0
    `;
    const params: any[] = [];
    
    if (phone) {
      query += ' AND phone = ?';
      params.push(phone);
    }
    
    query += ' GROUP BY phone';
    
    const [rows] = await pool.query(query, params);
    
    // Get total unread count across all conversations
    const [totalResult] = await pool.query(
      `SELECT COUNT(*) as total FROM \`messages-new\` WHERE direction = 'incoming' AND is_read = 0`
    );
    
    return NextResponse.json({ 
      success: true, 
      unread_by_phone: rows,
      total_unread: (totalResult as any[])[0]?.total || 0
    });
  } catch (error: any) {
    console.error('Error fetching unread counts:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}