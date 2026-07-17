// app/api/mark-read/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

export async function POST(request: NextRequest) {
  try {
    const { phone, messageIds } = await request.json();
    
    if (!phone) {
      return NextResponse.json({ error: 'Phone is required' }, { status: 400 });
    }
    
    let result;
    if (messageIds && messageIds.length > 0) {
      // Mark specific messages as read
      const placeholders = messageIds.map(() => '?').join(',');
      await pool.query(
        `UPDATE \`messages-new\` SET is_read = 1, updated_at = NOW() 
         WHERE phone = ? AND direction = 'incoming' AND id IN (${placeholders})`,
        [phone, ...messageIds]
      );
    } else {
      // Mark all incoming messages as read for this phone
      result = await pool.query(
        `UPDATE \`messages-new\` SET is_read = 1, updated_at = NOW() 
         WHERE phone = ? AND direction = 'incoming' AND is_read = 0`,
        [phone]
      );
    }
    
    // Get updated unread count
    const [unreadResult] = await pool.query(
      `SELECT COUNT(*) as unread_count FROM \`messages-new\` 
       WHERE phone = ? AND direction = 'incoming' AND is_read = 0`,
      [phone]
    );
    
    return NextResponse.json({ 
      success: true, 
      unread_count: (unreadResult as any[])[0]?.unread_count || 0 
    });
  } catch (error: any) {
    console.error('Error marking as read:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}