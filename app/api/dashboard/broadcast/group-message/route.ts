import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/db';

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`;

// Function to send WhatsApp message
async function sendWhatsAppMessage(recipient: { phone: string; name: string }, messageData: any) {
  try {
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
      console.error('WhatsApp API error:', data);
      return { success: false, error: data.error?.message || 'Failed to send message', messageId: null };
    }

    return { success: true, messageId: data.messages?.[0]?.id, error: null };
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return { success: false, error: 'Network error', messageId: null };
  }
}

// POST - Send broadcast message
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const groupId = formData.get('group_id') as string;
    const messageType = formData.get('type') as string;
    const content = formData.get('content') as string || '';
    const templateName = formData.get('template_name') as string;
    const templateVariablesJson = formData.get('template_variables') as string;
    const scheduledFor = formData.get('scheduled_for') as string;

    let templateVariables: Record<string, string> = {};
    if (templateVariablesJson) {
      templateVariables = JSON.parse(templateVariablesJson);
    }

    if (!groupId) {
      return NextResponse.json({ success: false, error: 'Group ID is required' }, { status: 400 });
    }

    // Get group details and contacts
    const [groups] = await pool.query(
      `SELECT bg.*, 
       (SELECT COUNT(*) FROM broadcast_group_contacts WHERE group_id = bg.id) as contact_count
       FROM broadcast_groups bg
       WHERE bg.id = ?`,
      [groupId]
    );

    if ((groups as any[]).length === 0) {
      return NextResponse.json({ success: false, error: 'Group not found' }, { status: 404 });
    }

    const group = (groups as any[])[0];

    // Get contacts in the group
    const [contacts] = await pool.query(
      `SELECT c.id, c.name, c.phone, c.country_code 
       FROM contacts c
       INNER JOIN broadcast_group_contacts bgc ON c.id = bgc.contact_id
       WHERE bgc.group_id = ?
       ORDER BY c.name ASC`,
      [groupId]
    );

    if ((contacts as any[]).length === 0) {
      return NextResponse.json({ success: false, error: 'No contacts in this group' }, { status: 400 });
    }

    // Validate based on message type
    if (messageType === 'text' && !content.trim()) {
      return NextResponse.json({ success: false, error: 'Message content is required' }, { status: 400 });
    }

    if (messageType === 'template' && !templateName) {
      return NextResponse.json({ success: false, error: 'Template name is required' }, { status: 400 });
    }

    // Validate schedule
    if (scheduledFor) {
      const scheduledDateTime = new Date(scheduledFor);
      if (scheduledDateTime <= new Date()) {
        return NextResponse.json({ success: false, error: 'Schedule time must be in the future' }, { status: 400 });
      }
    }

    // Create broadcast history record
    const [insertHistory] = await pool.query(
      `INSERT INTO broadcast_history 
       (group_id, name, type, content, template_name, media_url, recipients_count, status, scheduled_for, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        groupId,
        `Broadcast to ${group.name} - ${new Date().toLocaleString()}`,
        messageType,
        content,
        templateName || null,
        null,
        (contacts as any[]).length,
        scheduledFor ? 'scheduled' : 'processing',
        scheduledFor || null
      ]
    );

    const historyId = (insertHistory as any).insertId;

    // Handle scheduled broadcast
    if (scheduledFor) {
      // Save scheduled messages
      for (const contact of (contacts as any[])) {
        await pool.query(
          `INSERT INTO scheduled_messages 
           (history_id, recipient_phone, recipient_name, message_type, content, template_name, template_variables, scheduled_for, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
          [
            historyId,
            contact.phone,
            contact.name,
            messageType,
            content,
            templateName || null,
            JSON.stringify(templateVariables),
            scheduledFor
          ]
        );
      }

      // Update history status
      await pool.query(
        `UPDATE broadcast_history SET status = 'scheduled' WHERE id = ?`,
        [historyId]
      );

      return NextResponse.json({ 
        success: true, 
        scheduled: true, 
        historyId,
        recipients: (contacts as any[]).length,
        scheduledFor
      });
    }

    // Process immediate broadcast
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // Send messages to all recipients
    for (const contact of (contacts as any[])) {
      try {
        let messageData: any = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: contact.phone,
          type: messageType
        };

        if (messageType === 'text') {
          messageData.text = { body: content };
        } else if (messageType === 'template') {
          messageData.type = 'template';
          messageData.template = {
            name: templateName,
            language: { code: "en" },
            components: []
          };

          // Add template variables
          if (Object.keys(templateVariables).length > 0) {
            const bodyParams = [];
            // Handle different variable formats
            for (let i = 1; i <= Object.keys(templateVariables).length; i++) {
              const varValue = templateVariables[`var${i}`] || 
                              templateVariables[`{{${i}}}`] || 
                              Object.values(templateVariables)[i-1];
              if (varValue) {
                bodyParams.push({ type: "text", text: varValue });
              }
            }
            
            if (bodyParams.length > 0) {
              messageData.template.components.push({
                type: "body",
                parameters: bodyParams
              });
            }
          }
        } else if (messageType === 'media') {
          // For media, you would typically upload to WhatsApp first
          // This is a simplified version
          messageData.type = 'image';
          messageData.image = {
            link: content, // URL of the media
            caption: content
          };
        }

        const result = await sendWhatsAppMessage(contact, messageData);

        // Save message record
        await pool.query(
          `INSERT INTO broadcast_messages 
           (history_id, recipient_phone, recipient_name, status, message_id, error_message, sent_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            historyId,
            contact.phone,
            contact.name,
            result.success ? 'sent' : 'failed',
            result.messageId,
            result.error,
            result.success ? new Date() : null
          ]
        );

        if (result.success) {
          sent++;
        } else {
          failed++;
          errors.push(`${contact.phone}: ${result.error}`);
        }
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${contact.phone}: ${errorMsg}`);
        
        await pool.query(
          `INSERT INTO broadcast_messages 
           (history_id, recipient_phone, recipient_name, status, error_message) 
           VALUES (?, ?, ?, 'failed', ?)`,
          [historyId, contact.phone, contact.name, errorMsg]
        );
      }
    }

    // Update broadcast history with results
    await pool.query(
      `UPDATE broadcast_history 
       SET status = ?, sent_count = ?, failed_count = ? 
       WHERE id = ?`,
      [failed === 0 ? 'completed' : 'partial', sent, failed, historyId]
    );

    return NextResponse.json({ 
      success: true, 
      sent, 
      failed, 
      historyId,
      errors: errors.slice(0, 5) // Return first 5 errors
    });
  } catch (error) {
    console.error('Error sending broadcast:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}