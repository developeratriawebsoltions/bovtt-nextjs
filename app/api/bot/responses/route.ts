// app/api/bot/responses/route.ts
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

// GET all bot responses
export async function GET() {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM bot_responses ORDER BY priority ASC, id DESC'
    );
    return NextResponse.json({ success: true, responses: rows });
  } catch (error: any) {
    console.error('Error fetching bot responses:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Add new bot response
export async function POST(request: NextRequest) {
  try {
    const { trigger_keyword, response_text, response_type, template_name, priority, is_active } = await request.json();

    if (!trigger_keyword || !response_text) {
      return NextResponse.json({ error: 'Keyword and response are required' }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO bot_responses (trigger_keyword, response_text, response_type, template_name, priority, is_active) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [trigger_keyword.toLowerCase(), response_text, response_type || 'text', template_name || null, priority || 0, is_active !== false ? 1 : 0]
    );

    return NextResponse.json({ success: true, id: (result as any).insertId });
  } catch (error: any) {
    console.error('Error adding bot response:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT - Update bot response
export async function PUT(request: NextRequest) {
  try {
    const { id, trigger_keyword, response_text, response_type, template_name, priority, is_active } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await pool.query(
      `UPDATE bot_responses SET 
        trigger_keyword = ?, response_text = ?, response_type = ?, 
        template_name = ?, priority = ?, is_active = ?, updated_at = NOW() 
       WHERE id = ?`,
      [trigger_keyword.toLowerCase(), response_text, response_type || 'text', template_name || null, priority || 0, is_active ? 1 : 0, id]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating bot response:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - Remove bot response
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await pool.query('DELETE FROM bot_responses WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting bot response:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}