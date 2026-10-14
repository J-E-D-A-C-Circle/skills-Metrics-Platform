// Route /scales · Old URL: redirects to /framework?tab=scales
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Rating Scales · DVLA Skill Matrix & Assessment Platform',
};

export default function ScalesPage() {
  return <AppRouter initialPage="scales" />;
}
