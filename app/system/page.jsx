// Route /system · Old URL: redirects to /settings
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'System Settings · DVLA Skill Matrix & Assessment Platform',
};

export default function SystemPage() {
  return <AppRouter initialPage="system" />;
}
