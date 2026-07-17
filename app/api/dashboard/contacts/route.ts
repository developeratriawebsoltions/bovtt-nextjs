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

// GET all contacts
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const groupId = searchParams.get('groupId');
    const contactId = searchParams.get('id'); // Added for single contact fetch

    // Get single contact by ID
    if (contactId) {
      const [contacts] = await pool.query(
        'SELECT id, name, phone, label, country_code, created_at, updated_at, is_active FROM contacts WHERE id = ?',
        [contactId]
      );
      
      if ((contacts as any[]).length === 0) {
        return NextResponse.json({ 
          success: false, 
          error: 'Contact not found' 
        }, { status: 404 });
      }
      
      return NextResponse.json({ 
        success: true, 
        contact: (contacts as any[])[0] 
      });
    }

    let query = 'SELECT id, name, phone, label, country_code, created_at, updated_at, is_active FROM contacts WHERE 1=1';
    const params: any[] = [];

    // Search filter
    if (search) {
      query += ' AND (name LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Get contacts not in specific group
    if (groupId) {
      query += ` AND id NOT IN (
        SELECT contact_id FROM broadcast_group_contacts WHERE group_id = ?
      )`;
      params.push(groupId);
    }

    query += ' ORDER BY name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM contacts WHERE 1=1';
    const countParams: any[] = [];
    
    if (search) {
      countQuery += ' AND (name LIKE ? OR phone LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }
    
    if (groupId) {
      countQuery += ` AND id NOT IN (
        SELECT contact_id FROM broadcast_group_contacts WHERE group_id = ?
      )`;
      countParams.push(groupId);
    }
    
    const [countResult] = await pool.query(countQuery, countParams);
    const total = (countResult as any[])[0]?.total || 0;

    return NextResponse.json({ 
      success: true, 
      contacts: rows,
      total,
      limit,
      offset
    });
  } catch (error: any) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Add new contact
export async function POST(request: NextRequest) {
  try {
    const { name, phone, label, country_code } = await request.json();
    
    if (!name || !phone) {
      return NextResponse.json({ 
        success: false, 
        error: 'Name and phone are required' 
      }, { status: 400 });
    }
    
    // Validate phone number format
    const phoneRegex = /^[+]?[0-9]{10,15}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid phone number format' 
      }, { status: 400 });
    }
    
    // Check if contact exists
    const [existing] = await pool.query(
      'SELECT id, name, phone FROM contacts WHERE phone = ?',
      [phone]
    );
    
    if ((existing as any[]).length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Contact already exists',
        contact: (existing as any[])[0]
      }, { status: 400 });
    }
    
    // Insert new contact
    const [result] = await pool.query(
      `INSERT INTO contacts (name, phone, label, country_code, created_at) 
       VALUES (?, ?, ?, ?, NOW())`,
      [name, phone, label || 'none', country_code || '+91']
    );
    
    const contactId = (result as any).insertId;
    
    // Fetch the newly created contact
    const [newContact] = await pool.query(
      'SELECT id, name, phone, label, country_code, created_at, updated_at, is_active FROM contacts WHERE id = ?',
      [contactId]
    );
    
    return NextResponse.json({ 
      success: true, 
      contact: (newContact as any[])[0],
      id: contactId 
    });
  } catch (error: any) {
    console.error('Error adding contact:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT - Update contact
export async function PUT(request: NextRequest) {
  try {
    const { id, name, phone, label, country_code } = await request.json();
    
    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'ID is required' 
      }, { status: 400 });
    }
    
    // Check if contact exists
    const [existing] = await pool.query(
      'SELECT id FROM contacts WHERE id = ?',
      [id]
    );
    
    if ((existing as any[]).length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Contact not found' 
      }, { status: 404 });
    }
    
    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    
    if (name !== undefined && name.trim()) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    
    if (phone !== undefined && phone.trim()) {
      // Validate phone number format
      const phoneRegex = /^[+]?[0-9]{10,15}$/;
      if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid phone number format' 
        }, { status: 400 });
      }
      
      // Check if new phone number already exists
      const [phoneCheck] = await pool.query(
        'SELECT id FROM contacts WHERE phone = ? AND id != ?',
        [phone.trim(), id]
      );
      
      if ((phoneCheck as any[]).length > 0) {
        return NextResponse.json({ 
          success: false, 
          error: 'Phone number already exists' 
        }, { status: 400 });
      }
      
      updates.push('phone = ?');
      values.push(phone.trim());
    }
    
    if (label !== undefined) {
      updates.push('label = ?');
      values.push(label);
    }
    
    if (country_code !== undefined) {
      updates.push('country_code = ?');
      values.push(country_code);
    }
    
    if (updates.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No fields to update' 
      }, { status: 400 });
    }
    
    updates.push('updated_at = NOW()');
    values.push(id);
    
    await pool.query(
      `UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    // Fetch updated contact
    const [updatedContact] = await pool.query(
      'SELECT id, name, phone, label, country_code, created_at, updated_at, is_active FROM contacts WHERE id = ?',
      [id]
    );
    
    return NextResponse.json({ 
      success: true, 
      contact: (updatedContact as any[])[0]
    });
  } catch (error: any) {
    console.error('Error updating contact:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - Remove contact
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const force = searchParams.get('force') === 'true';
    
    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'ID is required' 
      }, { status: 400 });
    }
    
    // Get contact details first
    const [contactDetails] = await pool.query(
      'SELECT name, phone FROM contacts WHERE id = ?',
      [id]
    );
    
    if ((contactDetails as any[]).length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Contact not found' 
      }, { status: 404 });
    }
    
    // Check if contact is used in any broadcast groups
    const [groupUsage] = await pool.query(
      `SELECT bg.id, bg.name FROM broadcast_groups bg 
       INNER JOIN broadcast_group_contacts bgc ON bg.id = bgc.group_id 
       WHERE bgc.contact_id = ?`,
      [id]
    );
    
    if ((groupUsage as any[]).length > 0 && !force) {
      return NextResponse.json({ 
        success: false, 
        error: 'Contact is used in broadcast groups. Use force=true to delete anyway.',
        groups: groupUsage,
        canForce: true
      }, { status: 400 });
    }
    
    // Check if contact has broadcast history
    const [historyUsage] = await pool.query(
      `SELECT id FROM broadcast_messages 
       WHERE recipient_phone = (SELECT phone FROM contacts WHERE id = ?) 
       LIMIT 1`,
      [id]
    );
    
    if ((historyUsage as any[]).length > 0 && !force) {
      return NextResponse.json({ 
        success: false, 
        error: 'Contact has broadcast history. Use force=true to delete anyway.',
        canForce: true
      }, { status: 400 });
    }
    
    // Check if contact has comments
    const [comments] = await pool.query(
      'SELECT id FROM comments WHERE contact_id = ? LIMIT 1',
      [id]
    );
    
    // Check if contact has follow-ups
    const [followUps] = await pool.query(
      'SELECT id FROM follow_ups WHERE contact_id = ? LIMIT 1',
      [id]
    );
    
    // If force delete, remove related records first
    if (force) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        
        // Remove from broadcast groups
        await connection.query(
          'DELETE FROM broadcast_group_contacts WHERE contact_id = ?',
          [id]
        );
        
        // Remove comments
        await connection.query('DELETE FROM comments WHERE contact_id = ?', [id]);
        
        // Remove follow-ups
        await connection.query('DELETE FROM follow_ups WHERE contact_id = ?', [id]);
        
        // Delete contact
        await connection.query('DELETE FROM contacts WHERE id = ?', [id]);
        
        await connection.commit();
        
        return NextResponse.json({ 
          success: true, 
          message: 'Contact and associated records deleted successfully'
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    
    // Normal delete with related records
    if ((comments as any[]).length > 0 || (followUps as any[]).length > 0) {
      await pool.query('DELETE FROM comments WHERE contact_id = ?', [id]);
      await pool.query('DELETE FROM follow_ups WHERE contact_id = ?', [id]);
    }
    
    // Delete contact
    await pool.query('DELETE FROM contacts WHERE id = ?', [id]);
    
    return NextResponse.json({ 
      success: true,
      message: 'Contact deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting contact:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH - Bulk add contacts
export async function PATCH(request: NextRequest) {
  try {
    const { contacts } = await request.json();
    
    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Contacts array is required' 
      }, { status: 400 });
    }
    
    const results = {
      created: [] as any[],
      failed: [] as any[],
      existing: [] as any[]
    };
    
    for (const contact of contacts) {
      try {
        const { name, phone, label, country_code } = contact;
        
        if (!name || !phone) {
          results.failed.push({ ...contact, error: 'Name and phone are required' });
          continue;
        }
        
        // Validate phone number format
        const phoneRegex = /^[+]?[0-9]{10,15}$/;
        if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
          results.failed.push({ ...contact, error: 'Invalid phone number format' });
          continue;
        }
        
        // Check if contact exists
        const [existing] = await pool.query(
          'SELECT id, name, phone FROM contacts WHERE phone = ?',
          [phone]
        );
        
        if ((existing as any[]).length > 0) {
          results.existing.push((existing as any[])[0]);
          continue;
        }
        
        // Insert new contact
        const [result] = await pool.query(
          `INSERT INTO contacts (name, phone, label, country_code, created_at) 
           VALUES (?, ?, ?, ?, NOW())`,
          [name, phone, label || 'none', country_code || '+91']
        );
        
        results.created.push({
          id: (result as any).insertId,
          name,
          phone
        });
      } catch (error) {
        results.failed.push({ ...contact, error: (error as Error).message });
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      results,
      createdCount: results.created.length,
      existingCount: results.existing.length,
      failedCount: results.failed.length
    });
  } catch (error: any) {
    console.error('Error bulk adding contacts:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}