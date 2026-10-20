// Route /schedules · Old URL: redirects to /reports?tab=scheduled
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Scheduled Reports · DVLA Skill Matrix & Assessment Platform',
};

export default function SchedulesPage() {
  return <AppRouter initialPage="schedules" />;
}
