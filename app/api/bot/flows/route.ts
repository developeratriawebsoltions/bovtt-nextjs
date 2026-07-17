// app/api/bot/flows/route.ts
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

// GET all flows
export async function GET() {
  try {
    const [tables] = await pool.query("SHOW TABLES LIKE 'bot_flows'");
    if ((tables as any[]).length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'bot_flows table does not exist. Please create it first.' 
      });
    }
    
    const [rows] = await pool.query(
      'SELECT id, name, description, trigger_keyword, is_active, created_at, updated_at FROM bot_flows ORDER BY created_at DESC'
    );
    
    return NextResponse.json({ success: true, flows: rows });
  } catch (error: any) {
    console.error('Error fetching flows:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST create new flow - UPDATED
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, trigger_keyword, is_active, flow_data } = body;
    
    if (!name) {
      return NextResponse.json({ error: 'Flow name is required' }, { status: 400 });
    }
    
    // CRITICAL FIX: Preserve ALL edge data including conditions
    const flowDataToSave = {
      nodes: flow_data?.nodes || [],
      edges: []
    };
    
    if (flow_data?.edges && Array.isArray(flow_data.edges)) {
      flowDataToSave.edges = flow_data.edges.map((edge: any) => {
        // Extract condition from wherever it exists
        const conditionValue = edge.condition || edge.data?.condition || '';
        
        console.log(`Saving edge: ${edge.source} -> ${edge.target}, condition: "${conditionValue}"`);
        
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle || null,
          targetHandle: edge.targetHandle || null,
          condition: conditionValue,  // Save at root level
          data: { condition: conditionValue },  // Also save in data
          label: edge.label || (conditionValue ? conditionValue : undefined),
          labelStyle: edge.labelStyle,
          style: edge.style,
          markerEnd: edge.markerEnd,
          type: edge.type,
        };
      });
    }
    
    const flowDataJson = JSON.stringify(flowDataToSave);
    console.log('Saving flow_data:', JSON.stringify(flowDataToSave, null, 2));
    
    const [result] = await pool.query(
      'INSERT INTO bot_flows (name, description, trigger_keyword, is_active, flow_data) VALUES (?, ?, ?, ?, ?)',
      [name, description || null, trigger_keyword || null, is_active ? 1 : 0, flowDataJson]
    );
    
    return NextResponse.json({ success: true, id: (result as any).insertId });
  } catch (error: any) {
    console.error('Error creating flow:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
// PUT update flow - UPDATED
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, trigger_keyword, is_active, flow_data } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Flow ID is required' }, { status: 400 });
    }
    
    // CRITICAL FIX: Preserve ALL edge data including conditions
    const flowDataToSave = {
      nodes: flow_data?.nodes || [],
      edges: []
    };
    
    if (flow_data?.edges && Array.isArray(flow_data.edges)) {
      flowDataToSave.edges = flow_data.edges.map((edge: any) => {
        // Extract condition from wherever it exists
        const conditionValue = edge.condition || edge.data?.condition || '';
        
        console.log(`Saving edge: ${edge.source} -> ${edge.target}, condition: "${conditionValue}"`);
        
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle || null,
          targetHandle: edge.targetHandle || null,
          condition: conditionValue,
          data: { condition: conditionValue },
          label: edge.label || (conditionValue ? conditionValue : undefined),
          labelStyle: edge.labelStyle,
          style: edge.style,
          markerEnd: edge.markerEnd,
          type: edge.type,
        };
      });
    }
    
    const flowDataJson = JSON.stringify(flowDataToSave);
    console.log('Updating flow_data:', JSON.stringify(flowDataToSave, null, 2));
    
    await pool.query(
      'UPDATE bot_flows SET name = ?, description = ?, trigger_keyword = ?, is_active = ?, flow_data = ?, updated_at = NOW() WHERE id = ?',
      [name, description || null, trigger_keyword || null, is_active ? 1 : 0, flowDataJson, id]
    );
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating flow:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
// DELETE flow
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Flow ID is required' }, { status: 400 });
    }
    
    await pool.query('DELETE FROM bot_flows WHERE id = ?', [id]);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting flow:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}