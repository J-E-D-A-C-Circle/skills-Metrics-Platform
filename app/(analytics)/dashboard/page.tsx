// Route /dashboard · Old URL: redirects to /analytics (Overview)
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Analytics · DVLA Skill Matrix & Assessment Platform',
};

export default function DashboardPage() {
  return <AppRouter initialPage="dashboard" />;
}
