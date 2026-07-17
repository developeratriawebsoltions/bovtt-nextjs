import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const groupId = searchParams.get('id');

    if (groupId) {
      const [groups] = await pool.query(
        `SELECT bg.*, 
         (SELECT COUNT(*) FROM broadcast_group_contacts WHERE group_id = bg.id) as contact_count,
         (SELECT COUNT(*) FROM broadcast_history WHERE group_id = bg.id) as post_count
         FROM broadcast_groups bg
         WHERE bg.id = ?`,
        [groupId]
      );

      if ((groups as any[]).length === 0) {
        return NextResponse.json({ success: false, error: 'Group not found' }, { status: 404 });
      }

      const [contacts] = await pool.query(
        `SELECT c.id, c.name, c.phone, c.country_code, c.label 
         FROM contacts c
         INNER JOIN broadcast_group_contacts bgc ON c.id = bgc.contact_id
         WHERE bgc.group_id = ?
         ORDER BY c.name ASC`,
        [groupId]
      );

      return NextResponse.json({
        success: true,
        group: (groups as any[])[0],
        contacts: contacts
      });
    }

    const [groups] = await pool.query(
      `SELECT bg.*, 
       (SELECT COUNT(*) FROM broadcast_group_contacts WHERE group_id = bg.id) as contact_count,
       (SELECT COUNT(*) FROM broadcast_history WHERE group_id = bg.id) as post_count
       FROM broadcast_groups bg
       ORDER BY bg.created_at DESC`
    );

    return NextResponse.json({ success: true, groups });
  } catch (error: any) {
    console.error('Error in GET /api/dashboard/broadcast/group:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ 
        success: false, 
        error: 'Group name is required' 
      }, { status: 400 });
    }

    const [insertGroup] = await pool.query(
      `INSERT INTO broadcast_groups (name, description, type, created_at) 
       VALUES (?, ?, 'broadcast', NOW())`,
      [name.trim(), description?.trim() || null]
    );

    const groupId = (insertGroup as any).insertId;

    return NextResponse.json({ 
      success: true, 
      group: { 
        id: groupId, 
        name: name.trim(), 
        description: description?.trim() || null, 
        contact_count: 0,
        post_count: 0
      } 
    });
  } catch (error: any) {
    console.error('Error in POST /api/dashboard/broadcast/group:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description } = body;

    if (!id || !name || !name.trim()) {
      return NextResponse.json({ 
        success: false, 
        error: 'Group ID and name are required' 
      }, { status: 400 });
    }

    await pool.query(
      `UPDATE broadcast_groups 
       SET name = ?, description = ?, updated_at = NOW() 
       WHERE id = ?`,
      [name.trim(), description?.trim() || null, id]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in PUT /api/dashboard/broadcast/group:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
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
        error: 'Group ID required' 
      }, { status: 400 });
    }

    await pool.query(`DELETE FROM broadcast_groups WHERE id = ?`, [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/dashboard/broadcast/group:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}