import { NextRequest, NextResponse } from 'next/server';
import { RowDataPacket } from 'mysql2';
import pool from '@/app/lib/db';

// GET - Get contacts for a specific broadcast group
export async function GET(
  request: NextRequest,
  // { params }: { params: { id: string } }
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const groupId = (await params).id;
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const notInGroup = searchParams.get('notInGroup') === 'true';

    let query = `
      SELECT c.id, c.name, c.phone, c.country_code, c.label, c.created_at
      FROM contacts c
    `;
    const queryParams: any[] = [];

    if (notInGroup) {
      // Get contacts NOT in the group
      query += ` WHERE c.id NOT IN (
        SELECT contact_id FROM broadcast_group_contacts WHERE group_id = ?
      )`;
      queryParams.push(groupId);
    } else {
      // Get contacts IN the group
      query += ` INNER JOIN broadcast_group_contacts bgc ON c.id = bgc.contact_id
                WHERE bgc.group_id = ?`;
      queryParams.push(groupId);
    }

    if (search) {
      query += ` AND (c.name LIKE ? OR c.phone LIKE ?)`;
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY c.name ASC`;

    const [contacts] = await pool.query<RowDataPacket[]>(query, queryParams);

    // Get total count for the group
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM broadcast_group_contacts WHERE group_id = ?`,
      [groupId]
    );
    
    const totalInGroup = (countResult as any[])[0]?.total || 0;

    return NextResponse.json({ 
      success: true, 
      contacts,
      total: contacts.length,
      totalInGroup
    });
  } catch (error: any) {
    console.error('Error fetching group contacts:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// POST - Add contacts to broadcast group
export async function POST(
  request: NextRequest,
  // { params }: { params: { id: string } }
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const groupId = (await params).id;
    const { contactIds } = await request.json();

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Contact IDs array is required' 
      }, { status: 400 });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      let added = 0;
      let failed = 0;
      const errors: any[] = [];

      for (const contactId of contactIds) {
        try {
          // Check if contact already exists in group
          const [existing] = await connection.query(
            'SELECT id FROM broadcast_group_contacts WHERE group_id = ? AND contact_id = ?',
            [groupId, contactId]
          );

          if ((existing as any[]).length === 0) {
            await connection.query(
              `INSERT INTO broadcast_group_contacts (group_id, contact_id, created_at) 
               VALUES (?, ?, NOW())`,
              [groupId, contactId]
            );
            added++;
          } else {
            failed++;
            errors.push({ contactId, error: 'Contact already in group' });
          }
        } catch (error) {
          failed++;
          errors.push({ contactId, error: (error as Error).message });
        }
      }

      await connection.commit();

      return NextResponse.json({ 
        success: true, 
        added,
        failed,
        errors
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error('Error adding contacts to group:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// DELETE - Remove contact from broadcast group
export async function DELETE(
  request: NextRequest,
  // { params }: { params: { id: string } }
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const groupId = (await params).id;
    const searchParams = request.nextUrl.searchParams;
    const contactId = searchParams.get('contactId');

    if (!contactId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Contact ID is required' 
      }, { status: 400 });
    }

    await pool.query(
      'DELETE FROM broadcast_group_contacts WHERE group_id = ? AND contact_id = ?',
      [groupId, contactId]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing contact from group:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}