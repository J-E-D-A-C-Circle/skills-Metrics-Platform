// Route /targets · Old URL: redirects to /framework?tab=targets
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Target Profiles · DVLA Skill Matrix & Assessment Platform',
};

export default function TargetsPage() {
  return <AppRouter initialPage="targets" />;
}
