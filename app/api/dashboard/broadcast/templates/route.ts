import { NextRequest, NextResponse } from 'next/server';

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WABA_ID = process.env.WABA_ID;

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching WhatsApp templates...');
    console.log('WABA_ID:', WABA_ID);
    console.log('Token exists:', !!WHATSAPP_TOKEN);
    
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${WABA_ID}/message_templates`,
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API error:', data);
      return NextResponse.json({ 
        success: false, 
        error: data.error?.message || 'Failed to fetch templates',
        details: data.error
      }, { status: response.status });
    }

    // Format templates for easier use
    const formattedTemplates = (data.data || []).map((template: any) => {
      // Parse components to understand what variables are needed
      const components = template.components || [];
      const bodyComponent = components.find((c: any) => c.type === 'BODY');
      const headerComponent = components.find((c: any) => c.type === 'HEADER');
      const footerComponent = components.find((c: any) => c.type === 'FOOTER');
      const buttonsComponent = components.find((c: any) => c.type === 'BUTTONS');
      
      // Extract variables from body text
      let variables: string[] = [];
      if (bodyComponent && bodyComponent.text) {
        const matches = bodyComponent.text.match(/{{(\d+)}}/g);
        if (matches) {
          variables = matches.map((m: string) => m.replace(/{{|}}/g, ''));
        }
      }
      
      return {
        ...template,
        components,
        bodyText: bodyComponent?.text || '',
        headerType: headerComponent?.format || null,
        footerText: footerComponent?.text || null,
        buttons: buttonsComponent?.buttons || [],
        variables,
        variableCount: variables.length
      };
    });

    return NextResponse.json({ 
      success: true, 
      templates: formattedTemplates,
      raw: data.data || []
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}