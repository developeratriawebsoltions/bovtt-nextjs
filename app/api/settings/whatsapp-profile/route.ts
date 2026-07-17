import { NextRequest, NextResponse } from 'next/server';

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;

// GET - Fetch WhatsApp Business Profile
export async function GET() {
  try {
    const url = `https://graph.facebook.com/v18.0/${PHONE_ID}/whatsapp_business_profile`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('WhatsApp API error:', data);
      return NextResponse.json({ 
        success: false, 
        error: data.error?.message || 'Failed to fetch profile' 
      }, { status: response.status });
    }
    
    return NextResponse.json({ success: true, profile: data });
  } catch (error: any) {
    console.error('Error fetching WhatsApp profile:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT - Update WhatsApp Business Profile
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { about, address, description, email, websites, vertical } = body;
    
    const url = `https://graph.facebook.com/v18.0/${PHONE_ID}/whatsapp_business_profile`;
    
    const data: any = {
      messaging_product: "whatsapp"
    };
    
    if (about !== undefined) data.about = about;
    if (address !== undefined) data.address = address;
    if (description !== undefined) data.description = description;
    if (email !== undefined) data.email = email;
    if (websites !== undefined) data.websites = websites.filter((w: string) => w.trim());
    if (vertical !== undefined) data.vertical = vertical;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('WhatsApp API error:', result);
      return NextResponse.json({ 
        success: false, 
        error: result.error?.message || 'Failed to update profile' 
      }, { status: response.status });
    }
    
    return NextResponse.json({ success: true, profile: result });
  } catch (error: any) {
    console.error('Error updating WhatsApp profile:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}