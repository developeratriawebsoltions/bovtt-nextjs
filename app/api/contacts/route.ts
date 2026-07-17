// app/api/contacts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/db';

// GET all contacts
export async function GET() {
  try {
    const [rows] = await pool.query(
      'SELECT id, phone, name, label, country_code, created_at, updated_at FROM contacts ORDER BY name ASC'
    );
    return NextResponse.json({ success: true, contacts: rows });
  } catch (error: any) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Save or update contact
export async function POST(request: NextRequest) {
  try {
    const { phone, name, label } = await request.json();
    
    if (!phone || !name) {
      return NextResponse.json({ error: 'Phone and name are required' }, { status: 400 });
    }
    
    // Check if contact exists
    const [existing] = await pool.query(
      'SELECT id FROM contacts WHERE phone = ?',
      [phone]
    );
    
    if ((existing as any[]).length > 0) {
      // Update existing contact
      await pool.query(
        'UPDATE contacts SET name = ?, label = ?, updated_at = NOW() WHERE phone = ?',
        [name, label || 'none', phone]
      );
    } else {
      // Insert new contact
      await pool.query(
        'INSERT INTO contacts (phone, name, label, created_at) VALUES (?, ?, ?, NOW())',
        [phone, name, label || 'none']
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error saving contact:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - Remove contact
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    
    if (!phone) {
      return NextResponse.json({ error: 'Phone is required' }, { status: 400 });
    }
    
    await pool.query('DELETE FROM contacts WHERE phone = ?', [phone]);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting contact:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  
}

export async function PUT(request: NextRequest) {
  try {
    const { id, name, label } = await request.json();
    if (!id || !name) {
      return NextResponse.json({ error: 'ID and name are required' }, { status: 400 });
    }
    await pool.query(
      'UPDATE contacts SET name = ?, label = ?, updated_at = NOW() WHERE id = ?',
      [name, label || 'none', id]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}