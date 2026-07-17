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

// GET followups for a lead
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');
    
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Lead ID required' }, { status: 400 });
    }
    
    const [followups] = await pool.query(
      `SELECT * FROM lead_followups WHERE contact_id = ? ORDER BY followup_date ASC`,
      [leadId]
    );
    
    return NextResponse.json({ success: true, followups });
  } catch (error: any) {
    console.error('Error fetching followups:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Add followup
export async function POST(request: NextRequest) {
  try {
    const { leadId, followupDate, notes } = await request.json();
    
    if (!leadId || !followupDate) {
      return NextResponse.json({ success: false, error: 'Lead ID and followup date are required' }, { status: 400 });
    }
    
    const [result] = await pool.query(
      `INSERT INTO lead_followups (contact_id, followup_date, notes, status, created_at) 
       VALUES (?, ?, ?, 'pending', NOW())`,
      [leadId, followupDate, notes || null]
    );
    
    return NextResponse.json({ success: true, id: (result as any).insertId });
  } catch (error: any) {
    console.error('Error adding followup:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT - Update followup status
export async function PUT(request: NextRequest) {
  try {
    const { id, status } = await request.json();
    
    if (!id || !status) {
      return NextResponse.json({ success: false, error: 'ID and status are required' }, { status: 400 });
    }
    
    await pool.query(
      `UPDATE lead_followups SET status = ?, updated_at = NOW() WHERE id = ?`,
      [status, id]
    );
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating followup:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}