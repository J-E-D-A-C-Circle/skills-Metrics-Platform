// =============================================================================
// outlook.test.js · Unit tests for Outlook Add-in, Manifest, Calendar (.ics) & Reminders
// =============================================================================
import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/db', () => ({ db: {} }));
vi.mock('../lib/server/db', () => ({ db: {} }));
import {
  generateManifestXml,
  buildIcsCalendar,
  generateCalendarToken,
  verifyCalendarToken,
  escapeIcs,
  toIcsDate,
} from '../lib/server/calendar';

describe('Outlook Add-in Manifest Generation', () => {
  it('generates a valid Office Add-in XML manifest with the given base URL', () => {
    const xml = generateManifestXml('https://skillmatrix.dvla.gov.gh');
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<OfficeApp');
    expect(xml).toContain('xsi:type="MailApp"');
    expect(xml).toContain('<Id>60f08967-8ef3-40e1-bbcb-b0e6e76839cf</Id>');
    expect(xml).toContain('<ProviderName>Driver and Vehicle Licensing Authority (DVLA)</ProviderName>');
    expect(xml).toContain('<DisplayName DefaultValue="DVLA Tests &amp; Reminders" />');
    expect(xml).toContain('https://skillmatrix.dvla.gov.gh/outlook/taskpane');
    expect(xml).toContain('https://skillmatrix.dvla.gov.gh/outlook/icon-80.png');
    expect(xml).toContain('<AppDomain>https://webmail.dvla.gov.gh</AppDomain>');
    expect(xml).toContain('<Host Name="MailHost" />');
    expect(xml).toContain('<Set Name="Mailbox" MinVersion="1.5" />');
  });

  it('declares Ribbon commands for Message and Calendar surfaces in VersionOverrides', () => {
    const xml = generateManifestXml('https://my-host.internal');
    expect(xml).toContain('ExtensionPoint xsi:type="MessageReadCommandSurface"');
    expect(xml).toContain('ExtensionPoint xsi:type="AppointmentOrganizerCommandSurface"');
    expect(xml).toContain('ExtensionPoint xsi:type="AppointmentAttendeeCommandSurface"');
    expect(xml).toContain('Action xsi:type="ShowTaskpane"');
    expect(xml).toContain('https://my-host.internal/outlook/taskpane');
  });

  it('strips trailing slashes from baseUrl cleanly', () => {
    const xml = generateManifestXml('https://test.dvla.gov.gh///');
    expect(xml).not.toContain('https://test.dvla.gov.gh///');
    expect(xml).toContain('https://test.dvla.gov.gh/outlook/taskpane');
  });
});

describe('iCalendar (.ics) Generation and Reminders (VALARM)', () => {
  it('formats dates into UTC iCalendar format YYYYMMDDTHHMMSSZ', () => {
    const dt = new Date('2026-11-15T14:30:00.000Z');
    expect(toIcsDate(dt)).toBe('20261115T143000Z');
  });

  it('escapes special characters for iCalendar RFC 5545', () => {
    expect(escapeIcs('DVLA, Ghana; Staff & Test\nNew line')).toBe('DVLA\\, Ghana\\; Staff & Test\\nNew line');
  });

  it('builds an RFC 5545 calendar with native VALARM reminders for Outlook', () => {
    const mockTests = [
      {
        assessmentId: 101,
        title: 'Officer Competency Assessment',
        description: 'Covers core road safety and vehicle compliance.',
        instructions: 'Answer all 40 scenario items.',
        startsAt: '2026-11-10T08:00:00.000Z',
        deadline: '2026-11-12T17:00:00.000Z',
        durationMinutes: 90,
        maxAttempts: 3,
        attemptsUsed: 1,
        attemptsRemaining: 2,
        progressLabel: 'In progress',
        portalUrl: 'https://skillmatrix.dvla.gov.gh/take?id=101',
      },
    ];

    const mockStaff = {
      id: 11,
      staffNo: '100742',
      name: 'Desmond Opoku',
      email: 'desmond.opoku@dvla.gov.gh',
    };

    const ics = buildIcsCalendar({
      tests: mockTests,
      staff: mockStaff,
      baseUrl: 'https://skillmatrix.dvla.gov.gh',
    });

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('X-WR-CALNAME:DVLA Tests & Assessments');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:dvla-test-101-11@dvla.gov.gh');
    expect(ics).toContain('SUMMARY:[DVLA Test] Officer Competency Assessment');
    expect(ics).toContain('DTSTART:20261110T080000Z');
    expect(ics).toContain('DTEND:20261112T170000Z');
    expect(ics).toContain('STATUS:CONFIRMED');

    // Check Outlook Reminder 1: 24h before (-P1D)
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:-P1D');
    expect(ics).toContain('ACTION:DISPLAY');

    // Check Outlook Urgent Reminder 2: 2h before (-PT2H)
    expect(ics).toContain('TRIGGER:-PT2H');

    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('handles tests without start dates by calculating a start window before deadline', () => {
    const mockTests = [
      {
        assessmentId: 202,
        title: 'Driver Examiner Framework',
        deadline: '2026-12-01T12:00:00.000Z',
        durationMinutes: 60,
        maxAttempts: 2,
        attemptsUsed: 0,
        attemptsRemaining: 2,
        progressLabel: 'Not started',
      },
    ];

    const ics = buildIcsCalendar({ tests: mockTests, staff: { id: 5 } });
    expect(ics).toContain('DTEND:20261201T120000Z');
    // Start should be 60 mins before (11:00:00Z)
    expect(ics).toContain('DTSTART:20261201T110000Z');
  });
});

describe('Calendar Subscription Token Security', () => {
  it('generates reproducible tokens for staff email and staffNo', () => {
    const t1 = generateCalendarToken('100742', 'desmond.opoku@dvla.gov.gh');
    const t2 = generateCalendarToken('100742', 'desmond.opoku@dvla.gov.gh');
    expect(t1).toHaveLength(32);
    expect(t1).toBe(t2);
  });

  it('generates different tokens for different staff members', () => {
    const t1 = generateCalendarToken('100742', 'desmond.opoku@dvla.gov.gh');
    const t2 = generateCalendarToken('100523', 'joseph.ohemeng@dvla.gov.gh');
    expect(t1).not.toBe(t2);
  });

  it('verifies valid tokens and rejects tampered tokens', () => {
    const staffNo = '100742';
    const email = 'desmond.opoku@dvla.gov.gh';
    const token = generateCalendarToken(staffNo, email);

    expect(verifyCalendarToken(staffNo, email, token)).toBe(true);
    expect(verifyCalendarToken(staffNo, email, 'tampered-token-123')).toBe(false);
    expect(verifyCalendarToken(staffNo, 'other@dvla.gov.gh', token)).toBe(false);
    expect(verifyCalendarToken(staffNo, email, null)).toBe(false);
  });
});

describe('Outlook Calendar Invitation Email Dispatch (MIME / .ics)', () => {
  it('builds standard multipart email without calendar attachment', async () => {
    const { buildMimeMessage } = await import('../lib/server/mailer');
    const mime = buildMimeMessage({
      to: 'desmond.opoku@dvla.gov.gh',
      from: 'DVLA Skill Matrix <skillmatrix@dvla.gov.gh>',
      subject: 'Test Notification',
      text: 'Assessment assigned to you',
      html: '<p>Assessment assigned to you</p>',
    });

    expect(mime).toContain('To: desmond.opoku@dvla.gov.gh');
    expect(mime).toContain('Subject: Test Notification');
    expect(mime).toContain('Content-Type: multipart/alternative');
    expect(mime).toContain('Content-Type: text/html');
  });

  it('builds meeting invite email with text/calendar METHOD:REQUEST for Outlook RSVP', async () => {
    const { buildMimeMessage } = await import('../lib/server/mailer');
    const sampleIcs = 'BEGIN:VCALENDAR\r\nMETHOD:REQUEST\r\nBEGIN:VEVENT\r\nSUMMARY:DVLA Test\r\nEND:VEVENT\r\nEND:VCALENDAR';
    const mime = buildMimeMessage({
      to: 'desmond.opoku@dvla.gov.gh',
      from: 'DVLA Skill Matrix <skillmatrix@dvla.gov.gh>',
      subject: 'Upcoming Assessment Invitation',
      text: 'Please take your assessment',
      html: '<p>Please take your assessment</p>',
      icsContent: sampleIcs,
      filename: 'assessment-invite.ics',
    });

    expect(mime).toContain('Content-Type: multipart/mixed');
    expect(mime).toContain('Content-Type: text/calendar; method=REQUEST; charset=UTF-8; name="assessment-invite.ics"');
    expect(mime).toContain('METHOD:REQUEST');
    expect(mime).toContain('SUMMARY:DVLA Test');
  });

  it('handles email delivery gracefully in development environment', async () => {
    const { sendEmail } = await import('../lib/server/mailer');
    const res = await sendEmail({
      to: 'desmond.opoku@dvla.gov.gh',
      subject: 'Deadline reminder',
      text: 'Your assessment closes soon',
      html: '<p>Your assessment closes soon</p>',
    });

    expect(res.success).toBe(true);
    expect(['file', 'logged', 'smtp']).toContain(res.delivered);
  });
});
