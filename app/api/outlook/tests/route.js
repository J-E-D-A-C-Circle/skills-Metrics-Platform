// Route GET /api/outlook/tests · Retrieve assigned assessments and test schedule for Outlook
// Used by: Outlook Add-in Taskpane (/outlook/taskpane) and web calendar integration
import { readSession } from '@/lib/server/session';
import { getStaffCalendarEvents } from '@/lib/server/calendar';
import { json, handle } from '@/lib/server/http';

export const GET = handle(async (req) => {
  const url = new URL(req.url);
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const baseUrl = `${proto}://${host}`;

  // Check email or staffId in query params
  const emailParam = url.searchParams.get('email');
  const staffIdParam = url.searchParams.get('staffId');

  let identifier = emailParam || (staffIdParam ? Number(staffIdParam) : null);

  // If not provided in query params, fallback to logged-in session
  if (!identifier) {
    const session = await readSession();
    if (session?.account?.staff?.id) {
      identifier = session.account.staff.id;
    } else if (session?.account?.email) {
      identifier = session.account.email;
    }
  }

  if (!identifier) {
    return json({
      success: false,
      error: 'Please specify your DVLA email address or sign in to view your tests.',
      staff: null,
      tests: [],
    }, { status: 400 });
  }

  const result = await getStaffCalendarEvents(identifier, { baseUrl });

  if (!result.success) {
    return json(result, 404, { 'Access-Control-Allow-Origin': '*' });
  }

  return json(result, 200, { 'Access-Control-Allow-Origin': '*' });
});

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-requested-with',
    },
  });
}

