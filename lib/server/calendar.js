// =============================================================================
// calendar.js · Outlook Add-in & iCalendar Integration for DVLA Skill Matrix
// Screen / URL: /outlook/taskpane, /api/outlook/*, /outlook/manifest.xml
// Supports: Outlook Web App (webmail.dvla.gov.gh), Outlook Desktop & Mobile
// =============================================================================
import { createHash } from 'node:crypto';
import { db } from './db';
import { assessmentsForStaff, progressStatus, PROGRESS_LABEL } from './assigned';

// Generate / verify a secure calendar subscription token for a staff member
export function generateCalendarToken(staffNo, email) {
  const secret = process.env.JOBS_SECRET || 'dvla-skillmatrix-outlook-key-2026';
  return createHash('sha256')
    .update(`${staffNo || ''}:${email || ''}:${secret}`)
    .digest('hex')
    .slice(0, 32);
}

export function verifyCalendarToken(staffNo, email, token) {
  if (!token) return false;
  const expected = generateCalendarToken(staffNo, email);
  return expected.toLowerCase() === String(token).trim().toLowerCase();
}

// Format Date to iCalendar UTC (YYYYMMDDTHHMMSSZ)
export function toIcsDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Escape iCalendar text (comma, semicolon, backslash, newline)
export function escapeIcs(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Retrieve assigned assessments and calendar events for a staff member
export async function getStaffCalendarEvents(identifier, { baseUrl = 'https://skillmatrix.dvla.gov.gh', tx = db } = {}) {
  let staff = null;

  if (typeof identifier === 'number') {
    staff = await tx.staffRecord.findUnique({
      where: { id: identifier },
      include: { station: { include: { location: true } }, department: true, grade: true },
    });
  } else if (typeof identifier === 'string') {
    const clean = identifier.trim().toLowerCase();
    // 1. Try finding account by email or username
    const acc = await tx.account.findFirst({
      where: { OR: [{ email: clean }, { username: clean }] },
      include: { staff: { include: { station: { include: { location: true } }, department: true, grade: true } } },
    });

    if (acc?.staff) {
      staff = acc.staff;
    } else {
      // 2. Try staffRecord directly by email or staffNo
      staff = await tx.staffRecord.findFirst({
        where: { OR: [{ email: clean }, { staffNo: identifier.trim() }] },
        include: { station: { include: { location: true } }, department: true, grade: true },
      });
    }
  }

  if (!staff || staff.status !== 'ACTIVE') {
    return {
      success: false,
      error: 'Staff member record not found or account is inactive.',
      staff: null,
      tests: [],
    };
  }

  // Load published assessments assigned to this staff member
  const entries = await assessmentsForStaff(staff, tx);
  const now = new Date();

  // Load their attempts to evaluate status
  const attempts = await tx.attempt.findMany({
    where: { staffId: staff.id },
    orderBy: { attemptNo: 'asc' },
  });

  const tests = entries.map(e => {
    const mine = attempts.filter(a => a.assessmentId === e.assessmentId);
    const prog = progressStatus(e, mine, now);
    const remaining = Math.max(0, e.maxAttempts - mine.length);
    const deadlineMs = e.deadline ? new Date(e.deadline).getTime() : null;
    const isOverdue = prog === 'OVERDUE';
    const isCompleted = prog === 'COMPLETED';
    const isUrgent = !isCompleted && !isOverdue && deadlineMs && (deadlineMs - now.getTime() <= 48 * 3600 * 1000);

    // Fallback start time if not specified: 3 days before deadline or now
    const startsAt = e.startsAt || (e.deadline ? new Date(new Date(e.deadline).getTime() - 3 * 86400 * 1000) : now);
    const durationMins = e.assessment.durationMinutes || 60;

    return {
      assessmentId: e.assessmentId,
      title: e.assessment.title,
      description: e.assessment.description || 'DVLA Staff Competency Assessment',
      instructions: e.assessment.instructions || '',
      department: staff.department?.name || 'DVLA',
      startsAt: startsAt ? new Date(startsAt).toISOString() : null,
      deadline: e.deadline ? new Date(e.deadline).toISOString() : null,
      durationMinutes: durationMins,
      maxAttempts: e.maxAttempts,
      attemptsUsed: mine.length,
      attemptsRemaining: remaining,
      progress: prog,
      progressLabel: PROGRESS_LABEL[prog] || prog,
      isUrgent,
      isCompleted,
      isOverdue,
      canStart: prog !== 'COMPLETED' && remaining > 0 && (!e.startsAt || new Date(e.startsAt) <= now),
      portalUrl: `${baseUrl}/take?id=${e.assessmentId}`,
      calendarSyncUrl: `${baseUrl}/api/outlook/ics?assessmentId=${e.assessmentId}&staffId=${staff.id}`,
    };
  });

  const token = generateCalendarToken(staff.staffNo, staff.email);
  const feedUrl = `${baseUrl}/api/outlook/feed?email=${encodeURIComponent(staff.email || '')}&token=${token}`;

  return {
    success: true,
    staff: {
      id: staff.id,
      staffNo: staff.staffNo,
      name: `${staff.firstName || ''} ${staff.lastName || ''}`.trim(),
      email: staff.email,
      department: staff.department?.name || 'DVLA',
      grade: staff.grade?.name || 'Staff',
      calendarToken: token,
      feedUrl,
      webcalUrl: feedUrl.replace(/^https?:/, 'webcal:'),
    },
    tests,
  };
}

// Generate RFC 5545 iCalendar (.ics) String with reminders (VALARM)
export function buildIcsCalendar({ tests = [], staff = {}, baseUrl = 'https://skillmatrix.dvla.gov.gh' }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Driver and Vehicle Licensing Authority//DVLA Skill Matrix//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:DVLA Tests & Assessments',
    'X-WR-CALDESC:Official schedule and reminders for DVLA competency assessments',
    'X-WR-TIMEZONE:Africa/Accra',
  ];

  for (const t of tests) {
    if (!t.deadline) continue;
    const end = new Date(t.deadline);
    const start = t.startsAt ? new Date(t.startsAt) : new Date(end.getTime() - (t.durationMinutes || 60) * 60 * 1000);
    const uid = `dvla-test-${t.assessmentId}-${staff.id || 'staff'}@dvla.gov.gh`;
    const summary = `[DVLA Test] ${t.title}`;
    const desc = [
      `DVLA Skill Matrix Assessment`,
      `Title: ${t.title}`,
      `Status: ${t.progressLabel}`,
      `Allowed Attempts: ${t.maxAttempts} (Used: ${t.attemptsUsed}, Remaining: ${t.attemptsRemaining})`,
      `Deadline: ${end.toUTCString()}`,
      `Duration: ${t.durationMinutes} minutes`,
      ``,
      `Take Assessment: ${t.portalUrl || `${baseUrl}/take?id=${t.assessmentId}`}`,
      `Portal: ${baseUrl}/assessments`,
      ``,
      t.description ? `Description: ${t.description}` : '',
    ].filter(Boolean).join('\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${toIcsDate(start)}`,
      `DTEND:${toIcsDate(end)}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `DESCRIPTION:${escapeIcs(desc)}`,
      `LOCATION:DVLA Skill Matrix Portal (${escapeIcs(baseUrl)})`,
      `URL:${t.portalUrl || `${baseUrl}/take?id=${t.assessmentId}`}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      // Reminder 1: 24 Hours before deadline
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:Reminder: DVLA Assessment "${escapeIcs(t.title)}" deadline is in 24 hours!`,
      'TRIGGER:-P1D',
      'END:VALARM',
      // Reminder 2: 2 Hours before deadline (urgent alert)
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:Urgent: DVLA Assessment "${escapeIcs(t.title)}" deadline closes in 2 hours!`,
      'TRIGGER:-PT2H',
      'END:VALARM',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// Generate valid Outlook Add-in XML Manifest
export function generateManifestXml(baseUrl = 'https://skillmatrix.dvla.gov.gh') {
  // Ensure no trailing slash
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const id = '60f08967-8ef3-40e1-bbcb-b0e6e76839cf';

  return `<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp
          xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xmlns:bt="http://schemas.microsoft.com/office/officeappbasictypes/1.0"
          xmlns:mailappor="http://schemas.microsoft.com/office/mailappversionoverrides"
          xsi:type="MailApp">

  <!-- Manifest for DVLA Outlook Web App & Desktop Add-in -->
  <Id>${id}</Id>
  <Version>1.0.0.0</Version>
  <ProviderName>Driver and Vehicle Licensing Authority (DVLA)</ProviderName>
  <DefaultLocale>en-US</DefaultLocale>
  <DisplayName DefaultValue="DVLA Tests &amp; Reminders" />
  <Description DefaultValue="Keep track of assigned DVLA tests, synchronize assessment schedules with your Outlook calendar, and receive automated reminders in your DVLA Outlook account (webmail.dvla.gov.gh)." />
  <IconUrl DefaultValue="${cleanBase}/outlook/icon-80.png" />
  <HighResolutionIconUrl DefaultValue="${cleanBase}/outlook/icon-128.png" />
  <SupportUrl DefaultValue="${cleanBase}/outlook" />
  <AppDomains>
    <AppDomain>${cleanBase}</AppDomain>
    <AppDomain>https://webmail.dvla.gov.gh</AppDomain>
  </AppDomains>

  <Hosts>
    <Host Name="MailHost" />
  </Hosts>

  <Requirements>
    <Sets DefaultMinVersion="1.1">
      <Set Name="Mailbox" MinVersion="1.5" />
    </Sets>
  </Requirements>

  <FormSettings>
    <Form xsi:type="ItemRead">
      <DesktopSettings>
        <SourceLocation DefaultValue="${cleanBase}/outlook/taskpane" />
        <RequestedHeight>450</RequestedHeight>
      </DesktopSettings>
    </Form>
  </FormSettings>

  <Permissions>ReadWriteItem</Permissions>
  <Rule xsi:type="RuleCollection" Mode="Or">
    <Rule xsi:type="ItemIs" ItemType="Message" FormType="Read" />
    <Rule xsi:type="ItemIs" ItemType="Appointment" FormType="Read" />
  </Rule>
  <DisableEntityHighlighting>false</DisableEntityHighlighting>

  <VersionOverrides xmlns="http://schemas.microsoft.com/office/mailappversionoverrides" xsi:type="VersionOverridesV1_0">
    <Requirements>
      <bt:Sets DefaultMinVersion="1.5">
        <bt:Set Name="Mailbox" />
      </bt:Sets>
    </Requirements>
    <Hosts>
      <Host xsi:type="MailHost">
        <DesktopFormFactor>
          <!-- Message Read Ribbon Surface -->
          <ExtensionPoint xsi:type="MessageReadCommandSurface">
            <OfficeTab id="TabDefault">
              <Group id="dvlaGroupMessageRead">
                <Label resid="groupLabel" />
                <Control xsi:type="Button" id="btnDvlaTestsRead">
                  <Label resid="btnLabel" />
                  <Supertip>
                    <Title resid="btnLabel" />
                    <Description resid="btnSuperTip" />
                  </Supertip>
                  <Icon>
                    <bt:Image size="16" resid="icon16" />
                    <bt:Image size="32" resid="icon32" />
                    <bt:Image size="80" resid="icon80" />
                  </Icon>
                  <Action xsi:type="ShowTaskpane">
                    <SourceLocation resid="taskpaneUrl" />
                  </Action>
                </Control>
              </Group>
            </OfficeTab>
          </ExtensionPoint>

          <!-- Calendar Organizer Ribbon Surface -->
          <ExtensionPoint xsi:type="AppointmentOrganizerCommandSurface">
            <OfficeTab id="TabDefault">
              <Group id="dvlaGroupCalendarOrg">
                <Label resid="groupLabel" />
                <Control xsi:type="Button" id="btnDvlaTestsOrg">
                  <Label resid="btnLabel" />
                  <Supertip>
                    <Title resid="btnLabel" />
                    <Description resid="btnSuperTip" />
                  </Supertip>
                  <Icon>
                    <bt:Image size="16" resid="icon16" />
                    <bt:Image size="32" resid="icon32" />
                    <bt:Image size="80" resid="icon80" />
                  </Icon>
                  <Action xsi:type="ShowTaskpane">
                    <SourceLocation resid="taskpaneUrl" />
                  </Action>
                </Control>
              </Group>
            </OfficeTab>
          </ExtensionPoint>

          <!-- Calendar Attendee Ribbon Surface -->
          <ExtensionPoint xsi:type="AppointmentAttendeeCommandSurface">
            <OfficeTab id="TabDefault">
              <Group id="dvlaGroupCalendarAtt">
                <Label resid="groupLabel" />
                <Control xsi:type="Button" id="btnDvlaTestsAtt">
                  <Label resid="btnLabel" />
                  <Supertip>
                    <Title resid="btnLabel" />
                    <Description resid="btnSuperTip" />
                  </Supertip>
                  <Icon>
                    <bt:Image size="16" resid="icon16" />
                    <bt:Image size="32" resid="icon32" />
                    <bt:Image size="80" resid="icon80" />
                  </Icon>
                  <Action xsi:type="ShowTaskpane">
                    <SourceLocation resid="taskpaneUrl" />
                  </Action>
                </Control>
              </Group>
            </OfficeTab>
          </ExtensionPoint>
        </DesktopFormFactor>
      </Host>
    </Hosts>

    <Resources>
      <bt:Images>
        <bt:Image id="icon16" DefaultValue="${cleanBase}/outlook/icon-16.png" />
        <bt:Image id="icon32" DefaultValue="${cleanBase}/outlook/icon-32.png" />
        <bt:Image id="icon80" DefaultValue="${cleanBase}/outlook/icon-80.png" />
      </bt:Images>
      <bt:Urls>
        <bt:Url id="taskpaneUrl" DefaultValue="${cleanBase}/outlook/taskpane" />
      </bt:Urls>
      <bt:ShortStrings>
        <bt:String id="groupLabel" DefaultValue="DVLA Assessments" />
        <bt:String id="btnLabel" DefaultValue="DVLA Tests &amp; Reminders" />
      </bt:ShortStrings>
      <bt:LongStrings>
        <bt:String id="btnSuperTip" DefaultValue="View assigned competency tests, sync test deadlines to your Outlook calendar, and manage deadline reminders." />
      </bt:LongStrings>
    </Resources>
  </VersionOverrides>
</OfficeApp>`;
}

