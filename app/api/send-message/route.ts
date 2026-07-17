import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/db';

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WHATSAPP_API_URL = `https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_ID}/messages`;

export async function POST(request: NextRequest) {
  try {
    const { phone, message } = await request.json();

    console.log('📨 Received message request:', { phone, message });

    if (!phone || !message) {
      return NextResponse.json({ 
        success: false, 
        error: 'Phone number and message are required' 
      }, { status: 400 });
    }

    // Format phone number
    let formattedPhone = phone.replace(/\s/g, '');
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    console.log(`📞 Sending message to: ${formattedPhone}`);

    // Send WhatsApp message
    const messageData = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: formattedPhone,
      type: "text",
      text: { body: message }
    };

    const response = await fetch(WHATSAPP_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageData)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ WhatsApp API error:', data);
      return NextResponse.json({ 
        success: false, 
        error: data.error?.message || 'Failed to send message' 
      }, { status: response.status });
    }

    console.log(`✅ Message sent successfully to ${formattedPhone}`);

    // Save message to database
    await pool.query(
      `INSERT INTO \`messages-new\` 
       (phone, message, type, status, direction, created_at) 
       VALUES (?, ?, 'text', 'sent', 'outgoing', NOW())`,
      [formattedPhone, message]
    );

    return NextResponse.json({ 
      success: true, 
      messageId: data.messages?.[0]?.id 
    });
  } catch (error: any) {
    console.error('❌ Error sending message:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to send message' 
    }, { status: 500 });
  }
}