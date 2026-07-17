import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const contactId = searchParams.get('contactId');
    
    let query = `
      SELECT f.*, c.name as contact_name 
      FROM follow_ups f 
      LEFT JOIN contacts c ON f.contact_id = c.id
    `;
    const params: any[] = [];

    if (contactId) {
      query += ` WHERE f.contact_id = ?`;
      params.push(contactId);
    }
    
    query += ` ORDER BY f.follow_up_date ASC`;

    const [followUps] = await pool.query(query, params);

    return NextResponse.json({ success: true, followUps });
  } catch (error: any) {
    console.error('Error fetching follow-ups:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📅 Received follow-up request:', body);
    
    const { contactId, followUpDate, notes } = body;

    // Validate contactId
    if (!contactId) {
      console.error('❌ Contact ID is missing in request');
      return NextResponse.json({ 
        success: false, 
        error: 'Contact ID is required. Please select a contact first.' 
      }, { status: 400 });
    }
    
    // Validate followUpDate
    if (!followUpDate) {
      return NextResponse.json({ 
        success: false, 
        error: 'Follow-up date is required' 
      }, { status: 400 });
    }

    // Verify contact exists
    const [contact] = await pool.query(
      'SELECT id, name FROM contacts WHERE id = ?',
      [contactId]
    );

    if ((contact as any[]).length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: `Contact with ID ${contactId} not found` 
      }, { status: 404 });
    }

    console.log(`✅ Contact found: ${(contact as any[])[0].name} (ID: ${contactId})`);

    // Check if there's an existing pending follow-up
    const [existing] = await pool.query(
      `SELECT id FROM follow_ups 
       WHERE contact_id = ? AND status = 'pending'`,
      [contactId]
    );

    let result;
    if ((existing as any[]).length > 0) {
      // Update existing follow-up
      [result] = await pool.query(
        `UPDATE follow_ups 
         SET follow_up_date = ?, notes = ?, updated_at = NOW() 
         WHERE contact_id = ? AND status = 'pending'`,
        [followUpDate, notes || null, contactId]
      );
      console.log(`✅ Updated existing follow-up for contact ID: ${contactId}`);
    } else {
      // Insert new follow-up
      [result] = await pool.query(
        `INSERT INTO follow_ups (contact_id, follow_up_date, notes, status, created_at) 
         VALUES (?, ?, ?, 'pending', NOW())`,
        [contactId, followUpDate, notes || null]
      );
      console.log(`✅ Created new follow-up for contact ID: ${contactId} with ID: ${(result as any).insertId}`);
    }

    return NextResponse.json({ 
      success: true, 
      id: (result as any).insertId,
      message: 'Follow-up scheduled successfully'
    });
  } catch (error: any) {
    console.error('❌ Error adding follow-up:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to schedule follow-up' 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, status } = await request.json();

    if (!id || !status) {
      return NextResponse.json({ 
        success: false, 
        error: 'Follow-up ID and status are required' 
      }, { status: 400 });
    }

    await pool.query(
      `UPDATE follow_ups 
       SET status = ?, updated_at = NOW() 
       WHERE id = ?`,
      [status, id]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating follow-up:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Follow-up ID is required' 
      }, { status: 400 });
    }

    await pool.query('DELETE FROM follow_ups WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting follow-up:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}