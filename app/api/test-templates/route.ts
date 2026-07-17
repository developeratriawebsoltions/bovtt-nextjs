// app/api/test-templates/route.ts
export const runtime = 'nodejs';

export async function GET() {
	try {
		// Minimal response so this file is treated as a module during build
		return Response.json({ success: true, templates: [] });
	} catch (error: any) {
		console.error('test-templates error', error);
		return Response.json({ success: false, error: error?.message || 'Unknown error' });
	}
}

