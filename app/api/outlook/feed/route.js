// Route GET /api/outlook/feed · Live iCalendar subscription feed for Outlook Calendar
// Used by: Outlook Web App (webmail.dvla.gov.gh) via "Add Calendar" -> "Subscribe from web"
import { readSession } from '@/lib/server/session';
import { getStaffCalendarEvents, buildIcsCalendar, verifyCalendarToken } from '@/lib/server/calendar';

export async function GET(req) {
  const url = new URL(req.url);
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const baseUrl = `${proto}://${host}`;

  const email = url.searchParams.get('email');
  const token = url.searchParams.get('token');

  let staffIdentifier = email;

  // If token is supplied, verify it
  if (email && token) {
    const result = await getStaffCalendarEvents(email, { baseUrl });
    if (!result.success || !result.staff) {
      return new Response('Staff record not found', { status: 404 });
    }

    const isValid = verifyCalendarToken(result.staff.staffNo, result.staff.email, token);
    if (!isValid) {
      return new Response('Invalid calendar subscription token', { status: 403 });
    }

    const ics = buildIcsCalendar({
      tests: result.tests,
      staff: result.staff,
      baseUrl,
    });

    return new Response(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `inline; filename="dvla-${result.staff.staffNo}-tests.ics"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Fallback to logged-in session
  const session = await readSession();
  if (session?.account?.staff?.id) {
    staffIdentifier = session.account.staff.id;
  } else if (session?.account?.email) {
    staffIdentifier = session.account.email;
  }

  if (!staffIdentifier) {
    return new Response('Unauthorized: subscription token or valid session required', { status: 401 });
  }

  const result = await getStaffCalendarEvents(staffIdentifier, { baseUrl });
  if (!result.success || !result.staff) {
    return new Response(result.error || 'Staff record not found', { status: 404 });
  }

  const ics = buildIcsCalendar({
    tests: result.tests,
    staff: result.staff,
    baseUrl,
  });

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="dvla-${result.staff.staffNo}-tests.ics"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

