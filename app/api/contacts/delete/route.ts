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

export async function DELETE(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type');

    // Bulk delete (JSON body with phones array)
    if (contentType?.includes('application/json')) {
      const { phones } = await request.json();
      if (!phones || phones.length === 0) {
        return NextResponse.json({ error: 'No phones provided' }, { status: 400 });
      }
      const placeholders = phones.map(() => '?').join(',');
      await pool.query(`DELETE FROM contacts WHERE phone IN (${placeholders})`, phones);
      return NextResponse.json({ success: true });
    }

    // Single delete (query param)
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    if (!phone) {
      return NextResponse.json({ error: 'Phone is required' }, { status: 400 });
    }
    const [result] = await pool.query(
      'DELETE FROM contacts WHERE phone = ?',
      [decodeURIComponent(phone)]
    ) as any;

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting contact:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}