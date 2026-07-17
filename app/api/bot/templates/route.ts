// app/api/bot/templates/route.ts
export const runtime = 'nodejs';

export async function GET() {
  try {
    const token = process.env.WHATSAPP_TOKEN;
    const wabaId = process.env.WABA_ID;

    if (!token || !wabaId) {
      return Response.json({
        success: false,
        error: 'Missing WHATSAPP_TOKEN or WABA_ID in env'
      });
    }

    const url = `https://graph.facebook.com/v19.0/${wabaId}/message_templates`;

    const metaRes = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });

    const data = await metaRes.json();

    // Debug logs
    console.log('Meta API Response:', JSON.stringify(data, null, 2));

    if (!metaRes.ok) {
      return Response.json({
        success: false,
        error: data.error?.message || 'Failed to fetch templates',
        full_error: data
      });
    }

    return Response.json({
      success: true,
      templates: data.data || []
    });

  } catch (error: any) {
    console.error('Server Error:', error);

    return Response.json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}