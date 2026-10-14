// Route /settings · Settings (General / User Management / Audit Log tabs, admin only) · drawn by components/SMSystem.jsx
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'System Settings · DVLA Skill Matrix & Assessment Platform',
};

export default function SettingsPage() {
  return <AppRouter initialPage="settings" />;
}
