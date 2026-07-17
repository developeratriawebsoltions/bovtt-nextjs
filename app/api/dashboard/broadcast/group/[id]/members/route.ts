import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/db';

export async function GET(
   request: NextRequest,
  { params }: { params: Promise<{ id: string }>  }
) {
  try {
     const { id: groupId } = await params; // ✅ FIX
   const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');

    let membersQuery = `
      SELECT c.id, c.name, c.phone, c.country_code, c.label 
      FROM contacts c
      INNER JOIN broadcast_group_contacts bgc ON c.id = bgc.contact_id
      WHERE bgc.group_id = ?
    `;
    const queryParams: any[] = [groupId];

    if (search) {
      membersQuery += ` AND (c.name LIKE ? OR c.phone LIKE ?)`;
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    membersQuery += ` ORDER BY c.name ASC`;
    const [members] = await pool.query(membersQuery, queryParams);

    const [availableContacts] = await pool.query(
      `SELECT c.id, c.name, c.phone, c.country_code, c.label 
       FROM contacts c
       WHERE c.id NOT IN (
         SELECT contact_id FROM broadcast_group_contacts WHERE group_id = ?
       )
       ORDER BY c.name ASC`,
      [groupId]
    );

    return NextResponse.json({ 
      success: true, 
      members,
      availableContacts
    });
  } catch (error: any) {
    console.error('Error fetching group members:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(
   request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
     const { id: groupId } = await params;
    const { contactIds } = await request.json();

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Contact IDs are required' 
      }, { status: 400 });
    }

    let added = 0;
    let failed = 0;

    for (const contactId of contactIds) {
      try {
        const [existing] = await pool.query(
          'SELECT id FROM broadcast_group_contacts WHERE group_id = ? AND contact_id = ?',
          [groupId, contactId]
        );

        if ((existing as any[]).length === 0) {
          await pool.query(
            `INSERT INTO broadcast_group_contacts (group_id, contact_id, created_at) 
             VALUES (?, ?, NOW())`,
            [groupId, contactId]
          );
          added++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      added, 
      failed 
    });
  } catch (error: any) {
    console.error('Error adding members to group:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }>  }
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
    console.error('Error removing member from group:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}