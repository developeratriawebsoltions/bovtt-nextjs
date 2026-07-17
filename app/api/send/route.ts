// app/api/send/route.ts
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

// const WHATSAPP_TOKEN = "EAAnZCZAONZCX2ABRcQPJB1eKyBrgHCKEqZCZCXeT4H3q2DboUsyoEYZAbXkihnZBcNXqyqehLWFBnoXMU6Ul7tudTgEZCg1sZAKNyPl7NdwsTCybKQYTvGgM5biIdmGMmZCngsqw9KPQrO5J4B71xZAMsujH4HezYonHCUvC1gM2ZCtqvPR59Rm0ZB49bNZBFSt3ZBKZCQZDZD";
// const PHONE_ID = "1035497412988154";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const REMOTE_UPLOAD_URL = process.env.REMOTE_UPLOAD_URL || 'https://your-webhook-domain.com/upload.php';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const phone = formData.get('phone') as string;
    const message = formData.get('message') as string;
    const file = formData.get('file') as File | null;

    if (!phone) {
      return NextResponse.json({ error: 'Phone is required' }, { status: 400 });
    }

    // Handle text message only (no file)
    if (!file) {
      if (!message?.trim()) {
        return NextResponse.json({ error: 'Message is required' }, { status: 400 });
      }
      return await sendTextMessage(phone, message);
    }

    // Handle media message - upload to remote server first
    return await sendMediaMessage(phone, message, file);
    
  } catch (error: any) {
    console.error('Send message error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

async function sendTextMessage(phone: string, message: string) {
  try {
    const sendUrl = `https://graph.facebook.com/v25.0/${PHONE_ID}/messages`;
    
    const sendData = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'text',
      text: { 
        preview_url: false, 
        body: message 
      }
    };

    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sendData)
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('WhatsApp API Error:', result);
      return NextResponse.json({ 
        success: false, 
        error: result.error?.message || 'Failed to send message',
        details: result
      }, { status: response.status });
    }

    if (result.messages?.[0]?.id) {
      // Save to database
      await pool.query(
        `INSERT INTO \`messages-new\` 
         (phone, message, type, message_id, direction, status, created_at, updated_at) 
         VALUES (?, ?, 'text', ?, 'outgoing', 'sent', NOW(), NOW())`,
        [phone, message, result.messages[0].id]
      );
      
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ 
      success: false, 
      error: 'No message ID returned' 
    }, { status: 500 });
    
  } catch (error: any) {
    console.error('Send text error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

async function sendMediaMessage(phone: string, caption: string, file: File) {
  let uploadedFile = null;
  let mediaType = file.type.split('/')[0];
  
  // Handle document type
  if (mediaType === 'application') {
    mediaType = 'document';
  }
  
  try {
    // Step 1: Upload file to remote server
    console.log('📤 Uploading file to remote server...');
    const uploadFormData = new FormData();
    const buffer = Buffer.from(await file.arrayBuffer());
    const blob = new Blob([buffer], { type: file.type });
    uploadFormData.append('file', blob, file.name);
    uploadFormData.append('media_type', mediaType);
    uploadFormData.append('caption', caption || '');

    const uploadResponse = await fetch(REMOTE_UPLOAD_URL, {
      method: 'POST',
      body: uploadFormData
    });

    const uploadResult = await uploadResponse.json();
    
    if (!uploadResponse.ok || !uploadResult.success) {
      console.error('Remote upload error:', uploadResult);
      return NextResponse.json({ 
        success: false, 
        error: uploadResult.error || 'Failed to upload file to server',
        details: uploadResult
      }, { status: uploadResponse.status });
    }

    uploadedFile = uploadResult;
    console.log('✅ File uploaded to remote server:', uploadedFile.public_url);

    // Step 2: Upload to WhatsApp
    console.log('📤 Uploading to WhatsApp...');
    const whatsappFormData = new FormData();
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileBlob = new Blob([fileBuffer], { type: file.type });
    whatsappFormData.append('file', fileBlob, file.name);
    whatsappFormData.append('messaging_product', 'whatsapp');
    whatsappFormData.append('type', file.type);

    const uploadUrl = `https://graph.facebook.com/v25.0/${PHONE_ID}/media`;
    const whatsappUpload = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      },
      body: whatsappFormData
    });

    const whatsappResult = await whatsappUpload.json();
    
    if (!whatsappUpload.ok) {
      console.error('WhatsApp Upload Error:', whatsappResult);
      
      // Save to database with local file even if WhatsApp upload fails
      await pool.query(
        `INSERT INTO \`messages-new\` 
         (phone, message, type, local_file_path, media_url, file_size, mime_type, direction, status, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 'outgoing', 'failed', NOW(), NOW())`,
        [phone, caption || 'Media message', mediaType, uploadedFile.local_path, uploadedFile.public_url, uploadedFile.file_size, uploadedFile.mime_type]
      );
      
      return NextResponse.json({ 
        success: false, 
        error: whatsappResult.error?.message || 'Failed to upload to WhatsApp',
        localSaved: true,
        localPath: uploadedFile.public_url
      });
    }

    const mediaId = whatsappResult.id;
    console.log(`✅ Uploaded to WhatsApp, Media ID: ${mediaId}`);

    // Step 3: Send media message via WhatsApp
    const sendUrl = `https://graph.facebook.com/v25.0/${PHONE_ID}/messages`;
    
    const sendData: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: mediaType,
      [mediaType]: { 
        id: mediaId,
        caption: caption || ''
      }
    };

    const sendResponse = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sendData)
    });

    const sendResult = await sendResponse.json();
    
    if (!sendResponse.ok) {
      console.error('WhatsApp Send Error:', sendResult);
      
      // Save to database with local file
      await pool.query(
        `INSERT INTO \`messages-new\` 
         (phone, message, type, media_id, local_file_path, media_url, file_size, mime_type, direction, status, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'outgoing', 'failed', NOW(), NOW())`,
        [phone, caption || 'Media message', mediaType, mediaId, uploadedFile.local_path, uploadedFile.public_url, uploadedFile.file_size, uploadedFile.mime_type]
      );
      
      return NextResponse.json({ 
        success: false, 
        error: sendResult.error?.message || 'Failed to send media message',
        localSaved: true,
        localPath: uploadedFile.public_url
      });
    }

    if (sendResult.messages?.[0]?.id) {
      // Save to database with all media information
      await pool.query(
        `INSERT INTO \`messages-new\` 
         (phone, message, type, media_id, local_file_path, media_url, file_size, mime_type, message_id, direction, status, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'outgoing', 'sent', NOW(), NOW())`,
        [phone, caption || 'Media message', mediaType, mediaId, uploadedFile.local_path, uploadedFile.public_url, uploadedFile.file_size, uploadedFile.mime_type, sendResult.messages[0].id]
      );
      
      console.log(`✅ Media message sent and saved to database`);
      
      return NextResponse.json({ 
        success: true,
        mediaId: mediaId,
        localPath: uploadedFile.public_url,
        messageId: sendResult.messages[0].id
      });
    }

    return NextResponse.json({ 
      success: false, 
      error: 'No message ID returned' 
    });
    
  } catch (error: any) {
    console.error('Send media error:', error);
    
    // Attempt to save error state to database
    try {
      if (uploadedFile) {
        await pool.query(
          `INSERT INTO \`messages-new\` 
           (phone, message, type, local_file_path, media_url, file_size, mime_type, direction, status, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, 'outgoing', 'error', NOW(), NOW())`,
          [phone, caption || 'Media message', mediaType, uploadedFile.local_path, uploadedFile.public_url, uploadedFile.file_size, uploadedFile.mime_type]
        );
      }
    } catch (dbError) {
      console.error('Failed to save error state to database:', dbError);
    }
    
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      localSaved: uploadedFile ? true : false,
      localPath: uploadedFile?.public_url
    });
  }
}