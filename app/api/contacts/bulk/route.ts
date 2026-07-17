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

export async function POST(request: NextRequest) {
  try {
    const { contacts } = await request.json();

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: 'No contacts provided' }, { status: 400 });
    }

    console.log(`Bulk upload received: ${contacts.length} contacts`);
    console.log('First 3 samples:', JSON.stringify(contacts.slice(0, 3), null, 2));

    const validContacts: { phone: string; name: string; label: string }[] = [];
    const skippedRows: string[] = [];

    for (const contact of contacts) {
      const name = String(contact.name || '').trim();
      const phone = String(contact.phone || '').trim();

      if (!name || !phone || phone.length < 7) {
        skippedRows.push(`Skipped: name="${name}" phone="${phone}"`);
        continue;
      }

      validContacts.push({
        phone,
        name,
        label: contact.label || 'none',
      });
    }

    console.log(`Valid: ${validContacts.length}, Skipped: ${skippedRows.length}`);
    if (skippedRows.length > 0) {
      console.log('Skipped rows:', skippedRows.slice(0, 10));
    }

    if (validContacts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid contacts after validation',
        debug: { skippedRows: skippedRows.slice(0, 10) },
      }, { status: 400 });
    }

    const placeholders = validContacts.map(() => '(?, ?, ?, NOW(), NOW())').join(', ');
    const values = validContacts.flatMap((c) => [c.phone, c.name, c.label]);

    const [result] = await pool.query(
      `INSERT INTO contacts (phone, name, label, created_at, updated_at)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         label = VALUES(label),
         updated_at = NOW()`,
      values
    ) as any;

    const inserted = result.affectedRows - result.changedRows;
    const updated = result.changedRows;

    console.log(`DB result — affectedRows: ${result.affectedRows}, changedRows: ${result.changedRows}`);

    return NextResponse.json({
      success: true,
      summary: {
        inserted,
        updated,
        skipped: skippedRows.length,
        errors: 0,
      },
    });

  } catch (error: any) {
    console.error('Bulk upload DB error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      sqlState: error.sqlState,
      sqlCode: error.code,
    }, { status: 500 });
  }
}