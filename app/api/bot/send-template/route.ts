// app/api/bot/send-template/route.ts
import { NextRequest, NextResponse } from 'next/server';

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;

export async function POST(request: NextRequest) {
  try {
    const { phone, template_name, language, components } = await request.json();

    if (!phone || !template_name) {
      return NextResponse.json({ error: 'Phone and template name are required' }, { status: 400 });
    }

    const url = `https://graph.facebook.com/v25.0/${PHONE_ID}/messages`;
    
    const data: any = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: template_name,
        language: { code: language || 'en_US' }
      }
    };

    if (components) {
      data.template.components = components;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    
    if (response.ok) {
      return NextResponse.json({ success: true, message_id: result.messages?.[0]?.id });
    } else {
      console.error('META ERROR:', JSON.stringify(result, null, 2));
      return NextResponse.json({ success: false, error: result.error?.message, code: result.error?.code, details: result }, { status: response.status });
    }
  } catch (error: any) {
    console.error('Error sending template:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}