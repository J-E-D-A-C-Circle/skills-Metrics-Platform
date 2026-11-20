// Route /reports · Reports and exports · drawn by components/SMReports.jsx
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Report Builder · DVLA Skill Matrix & Assessment Platform',
};

export default function ReportsPage() {
  return <AppRouter initialPage="reports" />;
}
