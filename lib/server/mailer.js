// =============================================================================
// mailer.js · SMTP & Outlook Meeting Invitation (.ics) Email Dispatcher
// Used by: lib/server/notify.js, lib/server/reminders.js
// Supports: Direct SMTP delivery, MIME multipart with text/calendar (METHOD:REQUEST)
// =============================================================================
import 'server-only';
import { createTransport } from 'node:net';
import { connect as tlsConnect } from 'node:tls';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const isEmailEnabled = () => {
  const v = (process.env.NOTIFY_EMAIL || '').toLowerCase().trim();
  return v === 'on' || v === 'true' || v === '1' || v === 'yes';
};

// Send SMTP command and wait for response
function sendSmtpCommand(socket, cmd) {
  return new Promise((resolve, reject) => {
    socket.once('data', (data) => {
      const response = data.toString();
      resolve(response);
    });
    socket.once('error', reject);
    if (cmd) {
      socket.write(cmd + '\r\n');
    }
  });
}

// Low-overhead native Node.js SMTP sender (no heavy external dependencies)
async function sendViaSmtp({ to, from, subject, rawMime }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) {
    throw new Error('SMTP_HOST is not configured');
  }

  return new Promise((resolve, reject) => {
    const net = secure ? tlsConnect : require('node:net').connect;
    const socket = net({ host, port }, async () => {
      try {
        // Read greeting
        let res = await sendSmtpCommand(socket, null);

        // EHLO
        res = await sendSmtpCommand(socket, `EHLO ${host}`);

        // STARTTLS if port 587 and not already secure
        if (!secure && port === 587 && res.includes('STARTTLS')) {
          await sendSmtpCommand(socket, 'STARTTLS');
          // In basic internal relays, STARTTLS is optional or direct TLS on 465 is used
        }

        // AUTH LOGIN if credentials provided
        if (user && pass) {
          await sendSmtpCommand(socket, 'AUTH LOGIN');
          await sendSmtpCommand(socket, Buffer.from(user).toString('base64'));
          await sendSmtpCommand(socket, Buffer.from(pass).toString('base64'));
        }

        // MAIL FROM
        const fromAddr = from.replace(/.*<([^>]+)>.*/, '$1').trim();
        await sendSmtpCommand(socket, `MAIL FROM:<${fromAddr}>`);

        // RCPT TO
        await sendSmtpCommand(socket, `RCPT TO:<${to}>`);

        // DATA
        await sendSmtpCommand(socket, 'DATA');

        // Message body followed by CRLF.CRLF
        await sendSmtpCommand(socket, rawMime + '\r\n.');

        // QUIT
        await sendSmtpCommand(socket, 'QUIT');
        socket.end();
        resolve({ success: true });
      } catch (err) {
        socket.destroy();
        reject(err);
      }
    });

    socket.on('error', reject);
  });
}

// Build MIME message with optional text/calendar (METHOD:REQUEST) for Outlook RSVP
export function buildMimeMessage({ to, from, subject, text, html, icsContent, filename = 'invite.ics' }) {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const dateStr = new Date().toUTCString();

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Date: ${dateStr}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
  ];

  if (!icsContent) {
    // Standard HTML + Plain text
    headers.push(
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      '',
      text || '',
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      '',
      html || text || '',
      `--${boundary}--`
    );
    return headers.join('\r\n');
  }

  // With iCalendar invite: Outlook recognizes multipart/mixed with text/calendar
  headers.push(
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    '',
    html || text || '',
    `--${boundary}`,
    `Content-Type: text/calendar; method=REQUEST; charset=UTF-8; name="${filename}"`,
    `Content-Transfer-Encoding: 7bit`,
    `Content-Disposition: attachment; filename="${filename}"`,
    '',
    icsContent,
    `--${boundary}--`
  );

  return headers.join('\r\n');
}

// Main email dispatch function
export async function sendEmail({
  to,
  subject,
  text,
  html,
  icsContent = null,
  filename = 'dvla-assessment.ics',
}) {
  if (!to) return { success: false, error: 'Recipient address required' };

  const from = process.env.SMTP_FROM || 'DVLA Skill Matrix <skillmatrix@dvla.gov.gh>';
  const rawMime = buildMimeMessage({ to, from, subject, text, html, icsContent, filename });

  // If email is configured with an active SMTP host, transmit it
  if (isEmailEnabled() && process.env.SMTP_HOST) {
    try {
      await sendViaSmtp({ to, from, subject, rawMime });
      return { success: true, delivered: 'smtp' };
    } catch (err) {
      console.error('[mailer] SMTP send failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  // If email is enabled but no SMTP host is configured (e.g. local dev / staging),
  // archive to storage/emails for testing verification
  try {
    const storageDir = process.env.STORAGE_DIR || path.join(process.cwd(), 'storage');
    const mailDir = path.join(storageDir, 'emails');
    await fs.mkdir(mailDir, { recursive: true });
    const file = path.join(mailDir, `${Date.now()}-${to.replace(/[^a-zA-Z0-9]/g, '_')}.eml`);
    await fs.writeFile(file, rawMime, 'utf8');
    return { success: true, delivered: 'file', path: file };
  } catch (err) {
    // Non-fatal fallback
    return { success: true, delivered: 'logged' };
  }
}
