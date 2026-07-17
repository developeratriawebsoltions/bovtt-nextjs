// app/api/clear-chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ success: false, error: 'Phone required' });
    }

    await pool.execute(
      'DELETE FROM `messages-new` WHERE phone = ?',
      [phone]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Clear chat error:', error);
    return NextResponse.json({ success: false });
  }
}