// Route /analytics · Dashboards (Overview / Departments / Heatmap tabs) · drawn by components/SMOrgDashboard.jsx
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Analytics · DVLA Skill Matrix & Assessment Platform',
};

export default function AnalyticsPage() {
  return <AppRouter initialPage="analytics" />;
}
