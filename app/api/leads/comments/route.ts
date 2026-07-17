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

// GET comments for a lead
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');
    
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Lead ID required' }, { status: 400 });
    }
    
    const [comments] = await pool.query(
      `SELECT * FROM lead_comments WHERE contact_id = ? ORDER BY created_at DESC`,
      [leadId]
    );
    
    return NextResponse.json({ success: true, comments });
  } catch (error: any) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Add comment
export async function POST(request: NextRequest) {
  try {
    const { leadId, comment } = await request.json();
    
    if (!leadId || !comment) {
      return NextResponse.json({ success: false, error: 'Lead ID and comment are required' }, { status: 400 });
    }
    
    const [result] = await pool.query(
      `INSERT INTO lead_comments (contact_id, comment, created_at) VALUES (?, ?, NOW())`,
      [leadId, comment]
    );
    
    return NextResponse.json({ success: true, id: (result as any).insertId });
  } catch (error: any) {
    console.error('Error adding comment:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}