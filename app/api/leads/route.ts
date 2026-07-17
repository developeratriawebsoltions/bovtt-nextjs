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

// GET all leads from contacts table
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter');
    const search = searchParams.get('search');
    
    let query = `
      SELECT c.id, c.name, c.phone, c.address, c.label, 
       0 as comment_count,
       0 as pending_followups,
       c.created_at
      FROM contacts c 
      WHERE 1=1
    `;
    const params: any[] = [];
    
    // Apply label filter
    if (filter && filter !== 'all') {
      let labelValue = '';
      switch(filter) {
        case 'interested':
          labelValue = 'green';
          break;
        case 'prospect':
          labelValue = 'yellow';
          break;
        case 'not_interested':
          labelValue = 'red';
          break;
        case 'yet_to_qualify':
          labelValue = 'none';
          break;
      }
      if (labelValue) {
        query += ` AND c.label = ?`;
        params.push(labelValue);
      }
    }
    
    // Apply search
    if (search) {
      query += ` AND (c.name LIKE ? OR c.phone LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ` ORDER BY CASE WHEN c.label = 'none' THEN 0 ELSE 1 END, c.created_at DESC`;
    
    const [leads] = await pool.query(query, params);
    return NextResponse.json({ success: true, leads });
  } catch (error: any) {
    console.error('Error fetching leads:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Add new lead (contact)
export async function POST(request: NextRequest) {
  try {
    const { name, phone, address, label } = await request.json();
    
    console.log('Received lead data:', { name, phone, address, label }); // Debug log
    
    if (!name || !phone) {
      return NextResponse.json({ 
        success: false, 
        error: 'Name and phone are required' 
      }, { status: 400 });
    }
    
    // Check if contact already exists
    const [existing] = await pool.query(
      'SELECT id FROM contacts WHERE phone = ?',
      [phone]
    );
    
    if ((existing as any[]).length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Contact already exists' 
      }, { status: 400 });
    }
    
    // Insert new contact with address
    const [result] = await pool.query(
      `INSERT INTO contacts (name, phone, address, label, created_at) 
       VALUES (?, ?, ?, ?, NOW())`,
      [name, phone, address || null, label || 'none']
    );
    
    console.log('Lead inserted with ID:', (result as any).insertId); // Debug log
    
    return NextResponse.json({ 
      success: true, 
      id: (result as any).insertId 
    });
  } catch (error: any) {
    console.error('Error adding lead:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT - Update lead
export async function PUT(request: NextRequest) {
  try {
    const { id, name, phone, address, label } = await request.json();
    
    console.log('Updating lead:', { id, name, phone, address, label }); // Debug log
    
    if (!id || !name || !phone) {
      return NextResponse.json({ 
        success: false, 
        error: 'ID, name and phone are required' 
      }, { status: 400 });
    }
    
    await pool.query(
      `UPDATE contacts 
       SET name = ?, phone = ?, address = ?, label = ?, updated_at = NOW() 
       WHERE id = ?`,
      [name, phone, address || null, label, id]
    );
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating lead:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - Remove lead
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'ID is required' 
      }, { status: 400 });
    }
    
    // Delete related records first
    await pool.query('DELETE FROM lead_comments WHERE contact_id = ?', [id]);
    await pool.query('DELETE FROM lead_followups WHERE contact_id = ?', [id]);
    await pool.query(`DELETE FROM contacts WHERE id = ?`, [id]);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting lead:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}