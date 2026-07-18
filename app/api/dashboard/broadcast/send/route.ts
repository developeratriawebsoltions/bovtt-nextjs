import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/db';

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`;

async function uploadMediaToWhatsApp(file: File, type: string): Promise<string | null> {
  try {
    const formData = new FormData();
    const buffer = Buffer.from(await file.arrayBuffer());
    const blob = new Blob([buffer], { type: file.type });
    formData.append('file', blob, file.name);
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', file.type);
    
    const uploadUrl = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/media`;
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      },
      body: formData
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('Upload error:', result);
      return null;
    }
    
    return result.id;
  } catch (error) {
    console.error('Upload error:', error);
    return null;
  }
}

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
      return { success: false, error: data.error?.message || 'Failed to send message', messageId: null, details: data.error };
    }

    return { success: true, messageId: data.messages?.[0]?.id, error: null };
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return { success: false, error: 'Network error', messageId: null };
  }
}

// Helper function to format template message with media
function formatTemplateMessage(
  templateName: string, 
  language: string, 
  variables: Record<string, string>, 
  components: any[] = [],
  headerMediaId: string | null = null,
  headerMediaType: string | null = null
) {
  const templateComponents = [];
  
  // Handle header with media if present
  const headerComponent = components.find((c: any) => c.type === 'HEADER');
  const hasHeader = headerComponent && headerComponent.format;
  
  if (hasHeader && headerMediaId) {
    const headerFormat = headerComponent.format.toLowerCase();
    let paramType = 'text';
    let paramValue: any = {};
    
    switch (headerFormat) {
      case 'image':
        paramType = 'image';
        paramValue = { id: headerMediaId };
        break;
      case 'video':
        paramType = 'video';
        paramValue = { id: headerMediaId };
        break;
      case 'document':
        paramType = 'document';
        paramValue = { id: headerMediaId };
        break;
      default:
        paramType = 'text';
        paramValue = { text: headerMediaId };
    }
    
    templateComponents.push({
      type: 'header',
      parameters: [{
        type: paramType,
        [paramType]: paramValue
      }]
    });
  } else if (hasHeader && headerComponent.example?.header_handle) {
    // Use example media if available
    templateComponents.push({
      type: 'header',
      parameters: [{
        type: headerComponent.format.toLowerCase(),
        [headerComponent.format.toLowerCase()]: {
          id: headerComponent.example.header_handle[0]
        }
      }]
    });
  }
  
  // Handle body variables
  const variableValues = Object.values(variables).filter(v => v && v.trim());
  if (variableValues.length > 0) {
    const bodyParams = variableValues.map(value => ({
      type: "text",
      text: value
    }));
    
    templateComponents.push({
      type: "body",
      parameters: bodyParams
    });
  }
  
  // Handle buttons if present
  const buttonsComponent = components.find((c: any) => c.type === 'BUTTONS');
  if (buttonsComponent && buttonsComponent.buttons) {
    let buttonIndex = 0;
    for (const button of buttonsComponent.buttons) {
      if (button.type === 'URL' && variableValues.length > buttonIndex) {
        templateComponents.push({
          type: "button",
          sub_type: "url",
          index: buttonIndex,
          parameters: [{
            type: "text",
            text: variableValues[buttonIndex]
          }]
        });
        buttonIndex++;
      }
    }
  }
  
  return {
    name: templateName,
    language: { code: language || "en_US" },
    components: templateComponents
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const groupId = formData.get('group_id') as string;
    const messageType = formData.get('type') as string;
    const content = formData.get('content') as string || '';
    const templateName = formData.get('template_name') as string;
    const templateVariablesJson = formData.get('template_variables') as string;
    const scheduledFor = formData.get('scheduled_for') as string;
    const headerMediaFile = formData.get('header_media') as File | null;
    const headerMediaType = formData.get('header_media_type') as string || 'image';

    let templateVariables: Record<string, string> = {};
    if (templateVariablesJson) {
      templateVariables = JSON.parse(templateVariablesJson);
    }

    if (!groupId) {
      return NextResponse.json({ success: false, error: 'Group ID is required' }, { status: 400 });
    }

    const [groups] = await pool.query(
      `SELECT * FROM broadcast_groups WHERE id = ?`,
      [groupId]
    );

    if ((groups as any[]).length === 0) {
      return NextResponse.json({ success: false, error: 'Group not found' }, { status: 404 });
    }

    const group = (groups as any[])[0];

    const [contacts] = await pool.query(
      `SELECT c.id, c.name, c.phone, c.country_code 
       FROM contacts c
       INNER JOIN broadcast_group_contacts bgc ON c.id = bgc.contact_id
       WHERE bgc.group_id = ?
       ORDER BY c.name ASC`,
      [groupId]
    );

    const contactsList = contacts as any[];
    
    if (contactsList.length === 0) {
      return NextResponse.json({ success: false, error: 'No contacts in this group' }, { status: 400 });
    }

    if (messageType === 'text' && !content.trim()) {
      return NextResponse.json({ success: false, error: 'Message content is required' }, { status: 400 });
    }

    if (messageType === 'template' && !templateName) {
      return NextResponse.json({ success: false, error: 'Template name is required' }, { status: 400 });
    }

    // Fetch template details to get components
    let templateComponents: any[] = [];
    let hasMediaHeader = false;
    let headerFormat = null;
    
    if (messageType === 'template') {
      try {
        const wabaId = process.env.WABA_ID;
        const response = await fetch(
          `https://graph.facebook.com/v18.0/${wabaId}/message_templates?name=${templateName}`,
          {
            headers: {
              'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
            },
          }
        );
        const data = await response.json();
        if (data.data && data.data.length > 0) {
          templateComponents = data.data[0].components || [];
          const headerComp = templateComponents.find((c: any) => c.type === 'HEADER');
          if (headerComp && headerComp.format) {
            hasMediaHeader = true;
            headerFormat = headerComp.format.toLowerCase();
          }
        }
      } catch (error) {
        console.error('Error fetching template details:', error);
      }
    }

    // Upload header media if template requires it
    let uploadedMediaId = null;
    if (messageType === 'template' && hasMediaHeader && headerMediaFile) {
      uploadedMediaId = await uploadMediaToWhatsApp(headerMediaFile, headerMediaType);
      if (!uploadedMediaId) {
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to upload media for template header' 
        }, { status: 400 });
      }
    }

    if (scheduledFor) {
      const scheduledDateTime = new Date(scheduledFor);
      if (scheduledDateTime <= new Date()) {
        return NextResponse.json({ success: false, error: 'Schedule time must be in the future' }, { status: 400 });
      }
    }

    const [insertHistory] = await pool.query(
      `INSERT INTO broadcast_history 
       (group_id, name, type, content, template_name, recipients_count, status, scheduled_for, media_url, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        groupId,
        `Broadcast to ${group.name} - ${new Date().toLocaleString()}`,
        messageType,
        content,
        templateName || null,
        contactsList.length,
        scheduledFor ? 'scheduled' : 'processing',
        scheduledFor || null,
        uploadedMediaId || null
      ]
    );

    const historyId = (insertHistory as any).insertId;

    if (scheduledFor) {
      for (const contact of contactsList) {
        await pool.query(
          `INSERT INTO scheduled_messages 
           (history_id, recipient_phone, recipient_name, message_type, content, template_name, template_variables, scheduled_for, media_url, status, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
          [
            historyId,
            contact.phone,
            contact.name,
            messageType,
            content,
            templateName || null,
            JSON.stringify(templateVariables),
            scheduledFor,
            uploadedMediaId || null
          ]
        );
      }

      await pool.query(
        `UPDATE broadcast_history SET status = 'scheduled' WHERE id = ?`,
        [historyId]
      );

      return NextResponse.json({ 
        success: true, 
        scheduled: true, 
        historyId,
        recipients: contactsList.length,
        scheduledFor
      });
    }

    let sent = 0;
    let failed = 0;

    for (const contact of contactsList) {
      try {
        let messageData: any = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: contact.phone,
        };

        if (messageType === 'text') {
          messageData.type = 'text';
          messageData.text = { body: content };
        } else if (messageType === 'template') {
          messageData.type = 'template';
          const formattedTemplate = formatTemplateMessage(
            templateName,
            "en_US",
            templateVariables,
            templateComponents,
            uploadedMediaId,
            headerFormat
          );
          messageData.template = formattedTemplate;
        }

        const result = await sendWhatsAppMessage(contact, messageData);

        await pool.query(
          `INSERT INTO broadcast_messages 
           (history_id, recipient_phone, recipient_name, status, message_id, error_message, sent_at, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
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
          console.error(`Failed to send to ${contact.phone}:`, result.error);
        }
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error sending to ${contact.phone}:`, errorMsg);
        
        await pool.query(
          `INSERT INTO broadcast_messages 
           (history_id, recipient_phone, recipient_name, status, error_message, created_at) 
           VALUES (?, ?, ?, 'failed', ?, NOW())`,
          [historyId, contact.phone, contact.name, errorMsg]
        );
      }
    }

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
      historyId
    });
  } catch (error: any) {
    console.error('Error in POST /api/dashboard/broadcast/send:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}