// Route GET /api/outlook/ics · Downloads an RFC 5545 iCalendar (.ics) file with reminder alerts
// Used by: Outlook Add-in, OWA import, and "Add to Calendar" buttons
import { readSession } from '@/lib/server/session';
import { getStaffCalendarEvents, buildIcsCalendar } from '@/lib/server/calendar';

export async function GET(req) {
  const url = new URL(req.url);
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const baseUrl = `${proto}://${host}`;

  const emailParam = url.searchParams.get('email');
  const staffIdParam = url.searchParams.get('staffId');
  const assessmentIdParam = url.searchParams.get('assessmentId');

  let identifier = emailParam || (staffIdParam ? Number(staffIdParam) : null);

  if (!identifier) {
    const session = await readSession();
    if (session?.account?.staff?.id) {
      identifier = session.account.staff.id;
    } else if (session?.account?.email) {
      identifier = session.account.email;
    }
  }

  if (!identifier) {
    return new Response('Email or staff identifier required', { status: 400 });
  }

  const result = await getStaffCalendarEvents(identifier, { baseUrl });
  if (!result.success || !result.staff) {
    return new Response(result.error || 'Staff record not found', { status: 404 });
  }

  let tests = result.tests;
  let filename = `dvla-tests-${result.staff.staffNo || 'all'}.ics`;

  if (assessmentIdParam) {
    const id = Number(assessmentIdParam);
    tests = tests.filter(t => t.assessmentId === id);
    if (!tests.length) {
      return new Response('Assessment not found or not assigned to this staff member', { status: 404 });
    }
    filename = `dvla-test-${id}.ics`;
  }

  const ics = buildIcsCalendar({
    tests,
    staff: result.staff,
    baseUrl,
  });

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

