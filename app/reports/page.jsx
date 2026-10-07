import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Report Builder · DVLA Skill Matrix & Assessment Platform',
};

export default function ReportsPage() {
  return <AppRouter initialPage="reports" />;
}
