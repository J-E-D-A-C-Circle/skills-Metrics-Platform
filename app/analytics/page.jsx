import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Analytics & Reports · DVLA Skill Matrix & Assessment Platform',
};

export default function AnalyticsPage() {
  return <AppRouter initialPage="analytics" />;
}
