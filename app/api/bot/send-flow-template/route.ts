import { NextRequest, NextResponse } from 'next/server';

const PHONE_ID = process.env.WHATSAPP_PHONE_ID || process.env.WHATSAPP_PHONE_ID;
const TOKEN    = process.env.WHATSAPP_TOKEN    || process.env.WHATSAPP_TOKEN;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      phone,
      template_name,
      language = 'en',
      flow_token = 'unused',
      flow_action_data = {},
    } = body;

    if (!phone || !template_name) {
      return NextResponse.json(
        { success: false, error: 'phone and template_name are required' },
        { status: 400 }
      );
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: template_name,
        language: { code: language },
        components: [
          {
            type: 'button',
            sub_type: 'flow',
            index: '0',
            parameters: [
              {
                type: 'action',
                action: {
                  flow_token,
                  // Send {} not [] when empty — Meta rejects empty arrays
                  flow_action_data:
                    Object.keys(flow_action_data).length > 0
                      ? flow_action_data
                      : {},
                },
              },
            ],
          },
        ],
      },
    };

    const metaResponse = await fetch(
      `https://graph.facebook.com/v18.0/${PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const metaData = await metaResponse.json();

    if (!metaResponse.ok || metaData.error) {
      console.error('Meta API error:', JSON.stringify(metaData));
      return NextResponse.json(
        {
          success: false,
          error: metaData.error?.message || 'Meta API request failed',
          details: metaData,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: metaData });

  } catch (error) {
    console.error('send-flow-template error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}