import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const contactId = searchParams.get('contactId');

    if (!contactId) {
      return NextResponse.json({ success: false, error: 'Contact ID required' }, { status: 400 });
    }

    const [comments] = await pool.query(
      `SELECT id, contact_id, comment, created_at 
       FROM comments 
       WHERE contact_id = ? 
       ORDER BY created_at DESC`,
      [contactId]
    );

    return NextResponse.json({ success: true, comments });
  } catch (error: any) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📝 Received comment request:', body);
    
    const { contactId, comment } = body;

    // Validate contactId
    if (!contactId) {
      console.error('❌ Contact ID is missing in request');
      return NextResponse.json({ 
        success: false, 
        error: 'Contact ID is required. Please select a contact first.' 
      }, { status: 400 });
    }
    
    // Validate comment
    if (!comment || !comment.trim()) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment text is required' 
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

    // Insert comment
    const [result] = await pool.query(
      `INSERT INTO comments (contact_id, comment, created_at) 
       VALUES (?, ?, NOW())`,
      [contactId, comment.trim()]
    );

    console.log(`✅ Comment added with ID: ${(result as any).insertId}`);

    return NextResponse.json({ 
      success: true, 
      id: (result as any).insertId,
      message: 'Comment added successfully'
    });
  } catch (error: any) {
    console.error('❌ Error adding comment:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to add comment' 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment ID is required' 
      }, { status: 400 });
    }

    await pool.query('DELETE FROM comments WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}