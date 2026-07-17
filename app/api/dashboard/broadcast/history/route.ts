import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const groupId = searchParams.get('groupId');

    let queryStr = `
      SELECT bh.*, bg.name as group_name
      FROM broadcast_history bh
      LEFT JOIN broadcast_groups bg ON bh.group_id = bg.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (groupId) {
      queryStr += ` AND bh.group_id = ?`;
      params.push(groupId);
    }

    queryStr += ` ORDER BY bh.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [history] = await pool.query(queryStr, params);

    let countQuery = `SELECT COUNT(*) as total FROM broadcast_history WHERE 1=1`;
    const countParams: any[] = [];
    
    if (groupId) {
      countQuery += ` AND group_id = ?`;
      countParams.push(groupId);
    }
    
    const [countResult] = await pool.query(countQuery, countParams);

    return NextResponse.json({ 
      success: true, 
      history,
      total: (countResult as any[])[0]?.total || 0,
      limit,
      offset
    });
  } catch (error: any) {
    console.error('Error in GET /api/dashboard/broadcast/history:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}