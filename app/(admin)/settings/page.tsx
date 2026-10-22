// Route /settings · Settings (General / Scoring / Notification templates / User Management / Audit Log tabs) · drawn by components/SMSettings.jsx (User Management: SMSystem.jsx)
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'System Settings · DVLA Skill Matrix & Assessment Platform',
};

export default function SettingsPage() {
  return <AppRouter initialPage="settings" />;
}
