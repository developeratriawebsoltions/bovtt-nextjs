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
    // Get total messages
    const [totalMessagesResult] = await pool.query(
      'SELECT COUNT(*) as count FROM `messages-new`'
    );
    
    // Get total conversations (distinct phone numbers)
    const [conversationsResult] = await pool.query(
      'SELECT COUNT(DISTINCT phone) as count FROM `messages-new`'
    );
    
    // Get unread messages
    const [unreadResult] = await pool.query(
      'SELECT COUNT(*) as count FROM `messages-new` WHERE direction = "incoming" AND is_read = 0'
    );
    
    // Get active contacts (users with messages in last 7 days)
    const [activeContactsResult] = await pool.query(
      'SELECT COUNT(DISTINCT phone) as count FROM `messages-new` WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)'
    );
    
    // Get messages today
    const [todayMessagesResult] = await pool.query(
      'SELECT COUNT(*) as count FROM `messages-new` WHERE DATE(created_at) = CURDATE()'
    );
    
    // Calculate response rate (messages that got a reply within 1 hour)
    // This is a simplified calculation
    const [responseRateResult] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN reply_time <= 60 THEN 1 ELSE 0 END) as responded
      FROM (
        SELECT 
          m1.id,
          TIMESTAMPDIFF(MINUTE, m1.created_at, MIN(m2.created_at)) as reply_time
        FROM \`messages-new\` m1
        LEFT JOIN \`messages-new\` m2 ON m1.phone = m2.phone 
          AND m2.direction = 'outgoing' 
          AND m2.created_at > m1.created_at
        WHERE m1.direction = 'incoming'
        GROUP BY m1.id
      ) as replies
    `);
    
    const responseRate = (responseRateResult as any[])[0]?.total > 0
      ? Math.round(((responseRateResult as any[])[0]?.responded / (responseRateResult as any[])[0]?.total) * 100)
      : 0;
    
    // Average response time (minutes)
    const [avgResponseResult] = await pool.query(`
      SELECT AVG(reply_time) as avg_time FROM (
        SELECT 
          TIMESTAMPDIFF(MINUTE, m1.created_at, MIN(m2.created_at)) as reply_time
        FROM \`messages-new\` m1
        LEFT JOIN \`messages-new\` m2 ON m1.phone = m2.phone 
          AND m2.direction = 'outgoing' 
          AND m2.created_at > m1.created_at
        WHERE m1.direction = 'incoming'
        GROUP BY m1.id
        HAVING reply_time IS NOT NULL
      ) as replies
    `);
    
    const avgResponseTime = Math.round((avgResponseResult as any[])[0]?.avg_time || 0);
    
    return NextResponse.json({
      success: true,
      stats: {
        totalMessages: (totalMessagesResult as any[])[0]?.count || 0,
        totalConversations: (conversationsResult as any[])[0]?.count || 0,
        unreadCount: (unreadResult as any[])[0]?.count || 0,
        activeContacts: (activeContactsResult as any[])[0]?.count || 0,
        messagesToday: (todayMessagesResult as any[])[0]?.count || 0,
        responseRate: responseRate,
        avgResponseTime: avgResponseTime,
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}