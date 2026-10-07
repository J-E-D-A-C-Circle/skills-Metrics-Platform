import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Executive Dashboard · DVLA Skill Matrix & Assessment Platform',
};

export default function DashboardPage() {
  return <AppRouter initialPage="dashboard" />;
}
