import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Scheduled Reports · DVLA Skill Matrix & Assessment Platform',
};

export default function SchedulesPage() {
  return <AppRouter initialPage="schedules" />;
}
