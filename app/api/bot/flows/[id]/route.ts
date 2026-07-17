// app/api/bot/flows/[id]/route.ts
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    console.log('Fetching flow with ID:', id);
    
    const [rows] = await pool.query(
      'SELECT * FROM bot_flows WHERE id = ?',
      [parseInt(id)]
    );
    
    const flows = rows as any[];
    if (flows.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: `Flow with ID ${id} not found` 
      }, { status: 404 });
    }
    
    const flow = flows[0];
    
    // Parse flow_data
    let flowData = { nodes: [], edges: [] };
    if (flow.flow_data) {
      try {
        if (typeof flow.flow_data === 'string') {
          flowData = JSON.parse(flow.flow_data);
        } else {
          flowData = flow.flow_data;
        }
      } catch (e) {
        console.error('Error parsing flow_data:', e);
        flowData = { nodes: [], edges: [] };
      }
    }
    
    console.log('Raw edges from DB:', JSON.stringify(flowData.edges, null, 2));
    
    // Process nodes
    const nodes = (flowData.nodes || []).map((node: any, index: number) => ({
      id: node.id,
      type: node.type,
      position: node.position || { x: 100 + (index * 200), y: 100 + (index * 100) },
      data: node.data || { label: node.type || 'Node' }
    }));
    
    // CRITICAL FIX: Properly extract conditions from stored edges
    const edges = (flowData.edges || []).map((edge: any, index: number) => {
      // Try multiple possible locations for the condition
      let condition = '';
      
      if (edge.condition) {
        condition = edge.condition;
      } else if (edge.data?.condition) {
        condition = edge.data.condition;
      } else if (edge.label && !edge.condition) {
        // Sometimes the label might contain the condition
        condition = edge.label;
      }
      
      console.log(`Loading edge ${index}: ${edge.source} -> ${edge.target}, condition: "${condition}"`);
      
      return {
        id: edge.id || `edge_${index}_${Date.now()}`,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || null,
        targetHandle: edge.targetHandle || null,
        condition: condition,
        data: { condition: condition },
        markerEnd: { type: 'arrowclosed' },
        style: { stroke: '#00a884', strokeWidth: 2 },
        label: condition ? (condition.length > 15 ? condition.substring(0, 12) + '...' : condition) : undefined,
        labelStyle: { fill: '#00a884', fontWeight: 500, fontSize: 10 },
        type: 'smoothstep',
      };
    });
    
    const result = {
      id: flow.id,
      name: flow.name,
      description: flow.description,
      trigger_keyword: flow.trigger_keyword,
      is_active: flow.is_active === 1,
      flow_data: { nodes, edges },
      created_at: flow.created_at,
      updated_at: flow.updated_at
    };
    
    console.log(`Sending response with ${nodes.length} nodes and ${edges.length} edges`);
    console.log(`Edges with conditions: ${edges.filter(e => e.condition).length}`);
    
    return NextResponse.json({ success: true, flow: result });
  } catch (error: any) {
    console.error('Error fetching flow:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message
    }, { status: 500 });
  }
}
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, trigger_keyword, is_active, flow_data } = body;
    
    if (!name) {
      return NextResponse.json({ error: 'Flow name is required' }, { status: 400 });
    }
    
    // ✅ FIX: Preserve the complete edge data including conditions
    const flowDataToSave = {
      nodes: flow_data?.nodes || [],
      edges: []
    };
    
    // Properly map edges to preserve all properties including conditions
    if (flow_data?.edges && Array.isArray(flow_data.edges)) {
      flowDataToSave.edges = flow_data.edges.map((edge: any) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        condition: edge.condition || edge.data?.condition || '',
        data: { condition: edge.condition || edge.data?.condition || '' },
        label: edge.label,
        labelStyle: edge.labelStyle,
        style: edge.style || { stroke: '#00a884', strokeWidth: 2 },
        markerEnd: edge.markerEnd || { type: 'arrowclosed' },
        type: edge.type || 'smoothstep',
      }));
    }
    
    const flowDataJson = JSON.stringify(flowDataToSave);
    
    console.log('Updating flow:', { 
      id, 
      name, 
      trigger_keyword, 
      nodesCount: flowDataToSave.nodes.length,
      edgesCount: flowDataToSave.edges.length,
      conditionsCount: flowDataToSave.edges.filter((e: any) => e.condition).length
    });
    
    await pool.query(
      'UPDATE bot_flows SET name = ?, description = ?, trigger_keyword = ?, is_active = ?, flow_data = ?, updated_at = NOW() WHERE id = ?',
      [name, description || null, trigger_keyword || null, is_active ? 1 : 0, flowDataJson, parseInt(id)]
    );
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating flow:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    await pool.query('DELETE FROM bot_flows WHERE id = ?', [parseInt(id)]);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting flow:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}