'use client';
// =============================================================================
// /outlook · DVLA Outlook Add-in & Calendar Integration Hub
// Guide, Manifest Download, URL Copy, and Webmail Installation Instructions
// =============================================================================
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function OutlookIntegrationPage() {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedFeed, setCopiedFeed] = useState(false);
  const [origin, setOrigin] = useState('');
  const [testEmail, setTestEmail] = useState('desmond.opoku@dvla.gov.gh');
  const [activeTab, setActiveTab] = useState('url'); // 'url' | 'file' | 'feed'

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const manifestUrl = `${origin || 'https://skillmatrix.dvla.gov.gh'}/api/outlook/manifest`;
  const feedUrl = `${origin || 'https://skillmatrix.dvla.gov.gh'}/api/outlook/feed?email=${encodeURIComponent(testEmail)}`;

  function copyManifest() {
    navigator.clipboard.writeText(manifestUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 3000);
  }

  function copyFeed() {
    navigator.clipboard.writeText(feedUrl);
    setCopiedFeed(true);
    setTimeout(() => setCopiedFeed(false), 3000);
  }

  return (
    <div style={{
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      backgroundColor: '#f1f5f9',
      minHeight: '100vh',
      color: '#1e293b',
      paddingBottom: '40px',
    }}>
      {/* Top Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #004d34 0%, #006747 100%)',
        color: '#ffffff',
        padding: '32px 24px',
        borderBottom: '4px solid #ffd100',
        boxShadow: '0 4px 16px rgba(0, 103, 71, 0.15)',
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
            <img src="/assets/dvla-logo.png" alt="DVLA Logo" style={{ height: '46px', width: 'auto', backgroundColor: '#ffffff', borderRadius: '6px', padding: '3px' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', letterSpacing: '-0.3px' }}>
                DVLA Outlook Add-in &amp; Calendar Reminders
              </h1>
              <div style={{ fontSize: '14px', opacity: 0.9, marginTop: '2px' }}>
                Seamlessly update tests and receive reminder alerts in your DVLA Outlook account (webmail.dvla.gov.gh)
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <Link
              href="/assessments"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
              }}
            >
              ← Back to My Assessments
            </Link>
            <a
              href="https://webmail.dvla.gov.gh/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                backgroundColor: '#ffd100',
                color: '#004d34',
                textDecoration: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '700',
              }}
            >
              Open DVLA Webmail ↗
            </a>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ maxWidth: '1000px', margin: '24px auto', padding: '0 20px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
        
        {/* Left Column: Installation Methods & Overview */}
        <div>
          {/* Feature Highlights */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            marginBottom: '24px',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 12px 0', color: '#0f172a' }}>
              How the DVLA Outlook Add-in Works
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '16px' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>📅</div>
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a', marginBottom: '4px' }}>Calendar Updates</div>
                <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
                  Automatically detects test assignments and populates appointment details directly on your DVLA calendar.
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>🔔</div>
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a', marginBottom: '4px' }}>Native Reminders</div>
                <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
                  Rings audio and popup alarms in webmail.dvla.gov.gh 24 hours and 2 hours before assessment deadlines.
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>⚡</div>
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a', marginBottom: '4px' }}>1-Click Launch</div>
                <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
                  Start, resume, or check your test progress right from the Outlook sidebar without navigating away.
                </div>
              </div>
            </div>
          </div>

          {/* Installation Instructions with Tabs */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 16px 0', color: '#0f172a' }}>
              Installation in DVLA Webmail (webmail.dvla.gov.gh)
            </h2>

            {/* Tab navigation */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <button
                onClick={() => setActiveTab('url')}
                style={{
                  padding: '10px 18px',
                  fontWeight: '600',
                  fontSize: '13px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'url' ? '3px solid #006747' : '3px solid transparent',
                  color: activeTab === 'url' ? '#006747' : '#64748b',
                }}
              >
                Method 1: Add via URL (Recommended)
              </button>
              <button
                onClick={() => setActiveTab('file')}
                style={{
                  padding: '10px 18px',
                  fontWeight: '600',
                  fontSize: '13px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'file' ? '3px solid #006747' : '3px solid transparent',
                  color: activeTab === 'file' ? '#006747' : '#64748b',
                }}
              >
                Method 2: Add via File (manifest.xml)
              </button>
              <button
                onClick={() => setActiveTab('feed')}
                style={{
                  padding: '10px 18px',
                  fontWeight: '600',
                  fontSize: '13px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'feed' ? '3px solid #006747' : '3px solid transparent',
                  color: activeTab === 'feed' ? '#006747' : '#64748b',
                }}
              >
                Method 3: Live Calendar Subscription
              </button>
            </div>

            {/* Method 1: URL */}
            {activeTab === 'url' && (
              <div>
                <div style={{ fontSize: '13px', color: '#475569', marginBottom: '14px', lineHeight: 1.5 }}>
                  This installs the add-in directly using the hosted manifest URL. No file downloads needed.
                </div>

                <div style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '12.5px', color: '#0f172a', wordBreak: 'break-all' }}>
                    {manifestUrl}
                  </div>
                  <button
                    onClick={copyManifest}
                    style={{
                      backgroundColor: copiedUrl ? '#10b981' : '#006747',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {copiedUrl ? '✓ Copied!' : 'Copy URL'}
                  </button>
                </div>

                <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '10px', color: '#0f172a' }}>
                  Step-by-step instructions:
                </div>
                <ol style={{ paddingLeft: '20px', fontSize: '13px', color: '#334155', lineHeight: 1.7, margin: 0 }}>
                  <li>Open your DVLA webmail at <a href="https://webmail.dvla.gov.gh/" target="_blank" rel="noopener noreferrer" style={{ color: '#006747', fontWeight: '600' }}>https://webmail.dvla.gov.gh/</a>.</li>
                  <li>Click on the <strong>Settings (gear icon)</strong> in the top-right corner.</li>
                  <li>Click <strong>View all Outlook settings</strong> → select <strong>Mail</strong> → <strong>Customize actions</strong>.</li>
                  <li>Under the add-ins section (or <strong>Get Add-ins</strong> / <strong>Manage Add-ins</strong>), select <strong>My add-ins</strong>.</li>
                  <li>Scroll to the <strong>Custom add-ins</strong> section, click <strong>Add a custom add-in</strong> → <strong>Add from URL…</strong></li>
                  <li>Paste the copied URL above and click <strong>OK / Install</strong>.</li>
                  <li>The <strong>DVLA Tests &amp; Reminders</strong> add-in icon is now active on your emails and calendar!</li>
                </ol>
              </div>
            )}

            {/* Method 2: File */}
            {activeTab === 'file' && (
              <div>
                <div style={{ fontSize: '13px', color: '#475569', marginBottom: '14px', lineHeight: 1.5 }}>
                  Download the official Office Add-in manifest XML file and upload it into your DVLA webmail account.
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <a
                    href="/outlook/manifest.xml"
                    download="manifest.xml"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#006747',
                      color: '#ffffff',
                      textDecoration: 'none',
                      padding: '10px 18px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '700',
                    }}
                  >
                    <span>📥</span> Download manifest.xml
                  </a>
                </div>

                <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '10px', color: '#0f172a' }}>
                  Step-by-step instructions:
                </div>
                <ol style={{ paddingLeft: '20px', fontSize: '13px', color: '#334155', lineHeight: 1.7, margin: 0 }}>
                  <li>Click the button above to save <strong>manifest.xml</strong> to your computer.</li>
                  <li>Sign into your DVLA webmail at <a href="https://webmail.dvla.gov.gh/" target="_blank" rel="noopener noreferrer" style={{ color: '#006747', fontWeight: '600' }}>https://webmail.dvla.gov.gh/</a>.</li>
                  <li>Go to <strong>Settings</strong> → <strong>Manage Add-ins</strong> (or open any email → click <strong>… (More actions)</strong> → <strong>Get Add-ins</strong>).</li>
                  <li>Click <strong>My add-ins</strong>, scroll down to <strong>Custom add-ins</strong>.</li>
                  <li>Click <strong>Add a custom add-in</strong> → <strong>Add from file…</strong></li>
                  <li>Choose the <strong>manifest.xml</strong> file you just downloaded and click <strong>Install</strong>.</li>
                  <li>Done! Click the DVLA shield icon in any email or calendar meeting to view tests and reminders.</li>
                </ol>
              </div>
            )}

            {/* Method 3: Live Calendar Feed */}
            {activeTab === 'feed' && (
              <div>
                <div style={{ fontSize: '13px', color: '#475569', marginBottom: '14px', lineHeight: 1.5 }}>
                  Subscribe to your personal live test calendar feed. Whenever DVLA HR schedules new competency tests or extends deadlines, your Outlook calendar updates automatically in the background!
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Select your staff email for feed URL:
                  </label>
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      boxSizing: 'border-box',
                      marginBottom: '8px',
                    }}
                  />
                </div>

                <div style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#0f172a', wordBreak: 'break-all' }}>
                    {feedUrl}
                  </div>
                  <button
                    onClick={copyFeed}
                    style={{
                      backgroundColor: copiedFeed ? '#10b981' : '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {copiedFeed ? '✓ Copied!' : 'Copy Feed URL'}
                  </button>
                </div>

                <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '10px', color: '#0f172a' }}>
                  How to add to webmail.dvla.gov.gh Calendar:
                </div>
                <ol style={{ paddingLeft: '20px', fontSize: '13px', color: '#334155', lineHeight: 1.7, margin: 0 }}>
                  <li>In <a href="https://webmail.dvla.gov.gh/" target="_blank" rel="noopener noreferrer" style={{ color: '#006747', fontWeight: '600' }}>webmail.dvla.gov.gh</a>, switch to the <strong>Calendar</strong> view.</li>
                  <li>On the left calendar pane, click <strong>Add calendar</strong>.</li>
                  <li>Select <strong>Subscribe from web</strong>.</li>
                  <li>Paste the feed URL copied above, name it <strong>DVLA Tests &amp; Assessments</strong>, and choose a color (e.g. Green).</li>
                  <li>Click <strong>Import</strong>. Your calendar will now continuously sync test dates and remind you before deadlines!</li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Add-in Taskpane Preview */}
        <div>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #cbd5e1',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            overflow: 'hidden',
          }}>
            <div style={{
              backgroundColor: '#0f172a',
              color: '#ffffff',
              padding: '10px 14px',
              fontSize: '12px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span>Outlook Taskpane Preview</span>
              <span style={{ fontSize: '10px', opacity: 0.7 }}>Office.js Sandbox</span>
            </div>
            <iframe
              src="/outlook/taskpane"
              style={{
                width: '100%',
                height: '620px',
                border: 'none',
              }}
              title="Outlook Taskpane Simulator"
            />
          </div>
          <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '11.5px', color: '#64748b' }}>
            Interactive simulation of the taskpane as seen in webmail.dvla.gov.gh
          </div>
        </div>

      </div>
    </div>
  );
}

