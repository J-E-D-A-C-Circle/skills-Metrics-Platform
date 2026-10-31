'use client';
// =============================================================================
// /outlook/taskpane · Office.js Outlook Web Add-in Taskpane for DVLA Skill Matrix
// Embedded inside Outlook Web App (webmail.dvla.gov.gh) and Outlook Desktop
// =============================================================================
import React, { useEffect, useState } from 'react';
import Script from 'next/script';

export default function OutlookTaskpanePage() {
  const [officeReady, setOfficeReady] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [syncStatus, setSyncStatus] = useState('');
  const [copiedFeed, setCopiedFeed] = useState(false);

  // Initialize Office.js
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Office) {
      window.Office.onReady((info) => {
        setOfficeReady(true);
        if (info.host === window.Office.HostType.Outlook && window.Office.context?.mailbox) {
          const profile = window.Office.context.mailbox.userProfile;
          if (profile?.emailAddress) {
            setUserEmail(profile.emailAddress);
            setUserName(profile.displayName || '');
            loadTests(profile.emailAddress);
            return;
          }
        }
        // Fallback: check session or default demo
        loadTests('');
      });
    } else {
      // In standalone browser / preview mode
      const timer = setTimeout(() => {
        if (!userEmail) loadTests('');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  async function loadTests(email) {
    setLoading(true);
    setError('');
    try {
      const q = email ? `?email=${encodeURIComponent(email)}` : '';
      const res = await fetch(`/api/outlook/tests${q}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Unable to load assessments.');
      }
      setData(json);
      if (json.staff?.email && !userEmail) {
        setUserEmail(json.staff.email);
        setUserName(json.staff.name);
      }
    } catch (err) {
      setError(err.message || 'Error connecting to DVLA Skill Matrix');
    } finally {
      setLoading(false);
    }
  }

  // Create an appointment directly in Outlook using Office.js
  function handleAddToCalendar(test) {
    setSyncStatus(`Adding "${test.title}" to your Outlook calendar…`);

    const start = test.startsAt ? new Date(test.startsAt) : new Date();
    const end = test.deadline ? new Date(test.deadline) : new Date(start.getTime() + (test.durationMinutes || 60) * 60000);

    const bodyHtml = `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
        <div style="background: #006747; color: #ffffff; padding: 12px 16px; border-radius: 6px;">
          <h2 style="margin: 0; font-size: 18px; color: #ffffff;">DVLA Competency Assessment</h2>
          <div style="font-size: 13px; opacity: 0.9;">Driver and Vehicle Licensing Authority</div>
        </div>
        <div style="padding: 16px 0;">
          <p><strong>Assessment:</strong> ${test.title}</p>
          <p><strong>Department:</strong> ${test.department}</p>
          <p><strong>Submission Deadline:</strong> ${end.toLocaleString('en-GB')}</p>
          <p><strong>Duration:</strong> ${test.durationMinutes} minutes</p>
          <p><strong>Attempts Allowed:</strong> ${test.maxAttempts} (Used: ${test.attemptsUsed}, Remaining: ${test.attemptsRemaining})</p>
          <p><strong>Instructions:</strong> ${test.instructions || 'Ensure you complete all scenario questions before the deadline.'}</p>
          <div style="margin: 20px 0;">
            <a href="${test.portalUrl}" style="background: #006747; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
              Launch Assessment Portal
            </a>
          </div>
          <p style="font-size: 12px; color: #6b7280;"><em>Automated reminder set by DVLA Skill Matrix Outlook Integration.</em></p>
        </div>
      </div>
    `;

    if (window.Office && window.Office.context?.mailbox?.displayNewAppointmentForm) {
      window.Office.context.mailbox.displayNewAppointmentForm({
        requiredAttendees: userEmail ? [userEmail] : [],
        subject: `[DVLA Test] ${test.title}`,
        start: start,
        end: end,
        location: 'DVLA Skill Matrix Portal',
        body: bodyHtml,
      });
      setSyncStatus(`Appointment compose opened in Outlook! Please click "Save" to finalize.`);
      setTimeout(() => setSyncStatus(''), 6000);
    } else {
      // Fallback: trigger .ics download with embedded reminders
      window.open(test.calendarSyncUrl, '_blank');
      setSyncStatus(`Downloaded .ics calendar event with 24h & 2h reminder alarms!`);
      setTimeout(() => setSyncStatus(''), 5000);
    }
  }

  function handleCopyFeed() {
    if (data?.staff?.feedUrl) {
      navigator.clipboard.writeText(data.staff.feedUrl);
      setCopiedFeed(true);
      setTimeout(() => setCopiedFeed(false), 3000);
    }
  }

  const staff = data?.staff;
  const tests = data?.tests || [];
  const pendingTests = tests.filter(t => !t.isCompleted);

  return (
    <div style={{
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      color: '#111827',
      backgroundColor: '#f8fafc',
      minHeight: '100vh',
      padding: '16px',
      boxSizing: 'border-box',
    }}>
      <Script
        src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"
        onLoad={() => {
          if (window.Office) {
            window.Office.onReady(() => setOfficeReady(true));
          }
        }}
      />

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #004d34 0%, #006747 100%)',
        color: '#ffffff',
        padding: '16px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0, 103, 71, 0.2)',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <img src="/assets/dvla-logo.png" alt="DVLA" style={{ height: '32px', width: 'auto', backgroundColor: '#ffffff', borderRadius: '4px', padding: '2px' }} />
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', letterSpacing: '-0.2px' }}>DVLA Skill Matrix</div>
            <div style={{ fontSize: '11px', opacity: 0.85 }}>Outlook Test &amp; Reminder Hub</div>
          </div>
        </div>

        {staff ? (
          <div style={{
            fontSize: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
            padding: '8px 10px',
            borderRadius: '6px',
            marginTop: '6px',
          }}>
            <div style={{ fontWeight: '600' }}>{staff.name} ({staff.staffNo})</div>
            <div style={{ opacity: 0.9 }}>{staff.email} · {staff.department}</div>
          </div>
        ) : null}
      </div>

      {/* Status Alert Banner */}
      {syncStatus ? (
        <div style={{
          backgroundColor: '#ecfdf5',
          border: '1px solid #10b981',
          color: '#065f46',
          padding: '10px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          marginBottom: '14px',
          fontWeight: '500',
        }}>
          ✓ {syncStatus}
        </div>
      ) : null}

      {/* Manual lookup if no email detected or testing in browser */}
      {!staff && !loading && (
        <div style={{
          backgroundColor: '#ffffff',
          padding: '14px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#0f172a' }}>
            Identify DVLA Outlook Account
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginBottom: '10px' }}>
            Enter your official DVLA email to view your tests:
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="e.g. desmond.opoku@dvla.gov.gh"
              style={{
                flex: 1,
                padding: '7px 10px',
                fontSize: '12px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
              }}
            />
            <button
              onClick={() => loadTests(userEmail)}
              style={{
                backgroundColor: '#006747',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Load
            </button>
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
            Quick test: <a href="#test" onClick={(e) => { e.preventDefault(); setUserEmail('desmond.opoku@dvla.gov.gh'); loadTests('desmond.opoku@dvla.gov.gh'); }} style={{ color: '#006747', textDecoration: 'underline' }}>Desmond Opoku</a> · <a href="#test2" onClick={(e) => { e.preventDefault(); setUserEmail('admin@dvla.gov.gh'); loadTests('admin@dvla.gov.gh'); }} style={{ color: '#006747', textDecoration: 'underline' }}>Admin</a>
          </div>
        </div>
      )}

      {/* Loading & Error States */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b', fontSize: '13px' }}>
          Checking assigned tests &amp; deadlines…
        </div>
      )}

      {error && !loading && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #f87171',
          color: '#991b1b',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '12px',
          marginBottom: '16px',
        }}>
          <strong>Unable to load tests:</strong> {error}
        </div>
      )}

      {/* Upcoming / Active Tests List */}
      {!loading && !error && tests.length > 0 && (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
              Your Tests ({pendingTests.length} pending)
            </div>
            <button
              onClick={() => loadTests(userEmail)}
              style={{
                background: 'none',
                border: 'none',
                color: '#006747',
                fontSize: '11.5px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Refresh
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {tests.map((test) => {
              const deadlineDate = test.deadline ? new Date(test.deadline) : null;
              return (
                <div
                  key={test.assessmentId}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    border: test.isUrgent ? '1.5px solid #ef4444' : '1px solid #e2e8f0',
                    padding: '14px',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
                    position: 'relative',
                  }}
                >
                  {/* Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', lineHeight: 1.3 }}>
                      {test.title}
                    </div>
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      whiteSpace: 'nowrap',
                      backgroundColor: test.isCompleted ? '#dcfce7' : test.isUrgent ? '#fee2e2' : '#f1f5f9',
                      color: test.isCompleted ? '#15803d' : test.isUrgent ? '#b91c1c' : '#475569',
                    }}>
                      {test.isUrgent ? 'Closing Soon' : test.progressLabel}
                    </span>
                  </div>

                  {/* Meta details */}
                  <div style={{ fontSize: '11.5px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                    <div>
                      <strong>Deadline:</strong>{' '}
                      <span style={{ color: test.isUrgent ? '#b91c1c' : 'inherit', fontWeight: test.isUrgent ? '600' : 'normal' }}>
                        {deadlineDate ? deadlineDate.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No deadline'}
                      </span>
                    </div>
                    <div>
                      <strong>Attempts:</strong> {test.attemptsUsed} of {test.maxAttempts} used · {test.attemptsRemaining} remaining
                    </div>
                    <div>
                      <strong>Duration:</strong> {test.durationMinutes} mins
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleAddToCalendar(test)}
                      style={{
                        flex: 1,
                        backgroundColor: '#006747',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 10px',
                        fontSize: '11.5px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>📅</span> Add to Outlook
                    </button>

                    <a
                      href={test.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        backgroundColor: '#f1f5f9',
                        color: '#0f172a',
                        textDecoration: 'none',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '11.5px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {test.attemptsUsed > 0 ? 'Resume' : 'Start'}
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && tests.length === 0 && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          padding: '24px 16px',
          textAlign: 'center',
          border: '1px solid #e2e8f0',
        }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🎉</div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a', marginBottom: '4px' }}>No Pending Tests</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            You do not currently have any active assessments assigned to you.
          </div>
        </div>
      )}

      {/* Sync Options & Live Subscription */}
      {staff && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          padding: '14px',
          border: '1px solid #e2e8f0',
          marginTop: '16px',
        }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
            Outlook Calendar Sync
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginBottom: '10px', lineHeight: 1.4 }}>
            Subscribe to automatically keep your DVLA Outlook calendar synchronized with new tests and reminder alarms:
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={handleCopyFeed}
              style={{
                width: '100%',
                backgroundColor: copiedFeed ? '#10b981' : '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '9px 12px',
                fontSize: '11.5px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              {copiedFeed ? '✓ Feed URL Copied!' : '📋 Copy Outlook Subscription URL'}
            </button>

            <a
              href={`/api/outlook/ics?email=${encodeURIComponent(staff.email || '')}`}
              download={`dvla-tests-${staff.staffNo}.ics`}
              style={{
                width: '100%',
                backgroundColor: '#f8fafc',
                color: '#006747',
                border: '1px solid #006747',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '11.5px',
                fontWeight: '600',
                textAlign: 'center',
                textDecoration: 'none',
                boxSizing: 'border-box',
                display: 'block',
              }}
            >
              📥 Download All Tests (.ics with Reminders)
            </a>
          </div>

          <div style={{ marginTop: '10px', fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
            💡 <strong>In webmail.dvla.gov.gh:</strong> Open Calendar → "Add calendar" → "Subscribe from web" → paste the copied URL.
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '11px', color: '#94a3b8' }}>
        DVLA Skill Matrix Digital Assessment Platform
      </div>
    </div>
  );
}

