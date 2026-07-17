// app/api/messages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const phone = searchParams.get('phone');
  const lastId = parseInt(searchParams.get('lastId') || '0');
  const beforeId = parseInt(searchParams.get('beforeId') || '0');
  const limit = parseInt(searchParams.get('limit') || '50');

  if (!phone) {
    return NextResponse.json({ error: 'Phone is required' }, { status: 400 });
  }

  try {
    let query = `
      SELECT 
        id, 
        phone, 
        message, 
        type, 
        media_url, 
        media_id, 
        local_file_path, 
        file_size, 
        mime_type, 
        message_id, 
        reply_to_id, 
        reply_to_message,
        status, 
        direction, 
        created_at, 
        updated_at, 
        is_read,
        is_template,
        template_name
      FROM \`messages-new\` 
      WHERE phone = ?
    `;
    const params: any[] = [phone];
    
    // Load older messages (pagination)
    if (beforeId > 0) {
      query += ' AND id < ? ORDER BY id DESC LIMIT ?';
      params.push(beforeId, limit);
    } 
    // Load new messages (polling)
    else if (lastId > 0) {
      query += ' AND id > ? ORDER BY id ASC';
      params.push(lastId);
    } 
    // Initial load
    else {
      query += ' ORDER BY id ASC LIMIT ?';
      params.push(limit);
    }
    
    const [rows] = await pool.query(query, params);
    let messages = rows as any[];
    
    // If loading older messages, reverse to show oldest first
    if (beforeId > 0) {
      messages = messages.reverse();
    }
    
    // Get the first and last message IDs for pagination
    let firstMessageId = 0;
    let lastMessageId = 0;
    let hasMore = false;
    
    if (messages.length > 0) {
      firstMessageId = messages[0].id;
      lastMessageId = messages[messages.length - 1].id;
      
      // Check if there are more older messages
      if (beforeId === 0 && firstMessageId) {
        const [countResult] = await pool.query(
          'SELECT COUNT(*) as count FROM `messages-new` WHERE phone = ? AND id < ?',
          [phone, firstMessageId]
        );
        hasMore = (countResult as any[])[0]?.count > 0;
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      messages,
      pagination: {
        firstId: firstMessageId,
        lastId: lastMessageId,
        hasMore: hasMore,
        count: messages.length
      }
    });
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}