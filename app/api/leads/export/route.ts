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
  try {
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = `
      SELECT c.id, c.name, c.phone, c.address, c.label, 
       COALESCE((SELECT COUNT(*) FROM lead_comments WHERE contact_id = c.id), 0) as comment_count,
       COALESCE((SELECT COUNT(*) FROM lead_followups WHERE contact_id = c.id AND status = 'pending'), 0) as pending_followups,
       c.created_at
      FROM contacts c 
      WHERE 1=1
    `;
    const params: any[] = [];

    // Apply date filters
    if (month && year) {
      query += ` AND MONTH(c.created_at) = ? AND YEAR(c.created_at) = ?`;
      params.push(month, year);
    } else if (startDate && endDate) {
      query += ` AND DATE(c.created_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'Please provide either month/year or date range' 
      }, { status: 400 });
    }

    query += ` ORDER BY c.created_at DESC`;

    const [leads] = await pool.query(query, params);

    return NextResponse.json({ success: true, data: leads });
  } catch (error: any) {
    console.error('Error exporting leads:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}