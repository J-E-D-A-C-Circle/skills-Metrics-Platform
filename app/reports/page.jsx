// Route /reports · Reports (Report Builder / Scheduled tabs) · drawn by components/SMAnalytics.jsx
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Report Builder · DVLA Skill Matrix & Assessment Platform',
};

export default function ReportsPage() {
  return <AppRouter initialPage="reports" />;
}
