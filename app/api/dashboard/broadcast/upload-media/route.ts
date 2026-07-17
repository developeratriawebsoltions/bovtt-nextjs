import { NextRequest, NextResponse } from 'next/server';

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string || 'image';
    
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }
    
    // Validate file size (max 16MB for images/videos)
    const maxSize = 16 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ 
        success: false, 
        error: 'File size must be less than 16MB' 
      }, { status: 400 });
    }
    
    // Upload to WhatsApp
    const uploadFormData = new FormData();
    const buffer = Buffer.from(await file.arrayBuffer());
    const blob = new Blob([buffer], { type: file.type });
    uploadFormData.append('file', blob, file.name);
    uploadFormData.append('messaging_product', 'whatsapp');
    uploadFormData.append('type', file.type);
    
    const uploadUrl = `https://graph.facebook.com/v18.0/${PHONE_ID}/media`;
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      },
      body: uploadFormData
    });
    
    const uploadResult = await uploadResponse.json();
    
    if (!uploadResponse.ok) {
      console.error('WhatsApp upload error:', uploadResult);
      return NextResponse.json({ 
        success: false, 
        error: uploadResult.error?.message || 'Failed to upload media' 
      }, { status: uploadResponse.status });
    }
    
    return NextResponse.json({ 
      success: true, 
      media_id: uploadResult.id,
      media_type: file.type
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}