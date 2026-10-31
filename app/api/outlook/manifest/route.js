// Route GET /api/outlook/manifest · Serves the Outlook Add-in manifest XML
// Used by: Outlook Web App (webmail.dvla.gov.gh) via "Add from URL" or "Add from file"
import { generateManifestXml } from '@/lib/server/calendar';

export async function GET(req) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const baseUrl = `${proto}://${host}`;

  const xml = generateManifestXml(baseUrl);

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': 'inline; filename="manifest.xml"',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

