import { NextResponse } from 'next/server';

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;

export async function GET() {
  try {
    // Test the token by fetching phone number info
    const testUrl = `https://graph.facebook.com/v18.0/${PHONE_ID}`;
    
    const response = await fetch(testUrl, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      return NextResponse.json({ 
        success: true, 
        message: "Token is valid!",
        data: data 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: "Token is invalid or expired",
        details: data,
        status: response.status
      }, { status: 401 });
    }
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}