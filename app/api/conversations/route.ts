// app/api/conversations/route.ts
import { NextResponse } from 'next/server';
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

export async function GET() {
  try {
   const [rows] = await pool.query(`
  SELECT 
    m.phone,
    MAX(m.created_at) as last_time,
    SUBSTRING_INDEX(
      GROUP_CONCAT(m.message ORDER BY m.id DESC SEPARATOR '|||'),
      '|||', 1
    ) as last_message,
    SUBSTRING_INDEX(
      GROUP_CONCAT(m.type ORDER BY m.id DESC SEPARATOR '|||'),
      '|||', 1
    ) as last_type,
    SUBSTRING_INDEX(
      GROUP_CONCAT(m.type ORDER BY m.id DESC SEPARATOR '|||'),
      '|||', 1
    ) as last_type,
    SUM(CASE 
      WHEN m.direction = 'incoming' AND m.is_read = 0 
      THEN 1 ELSE 0 
    END) as unread_count,
    c.name as contact_name,
    c.label as contact_label
  FROM \`messages-new\` m
  LEFT JOIN contacts c ON m.phone = c.phone
  GROUP BY m.phone
  ORDER BY last_time DESC
`);
    return NextResponse.json({ success: true, conversations: rows });
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}