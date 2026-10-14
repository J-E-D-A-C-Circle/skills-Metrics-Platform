// Route /plan · Old URL: opens /profile?tab=plan (Development Plan)
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Development Plan · DVLA Skill Matrix & Assessment Platform',
};

export default function PlanPage() {
  return <AppRouter initialPage="profile" initialTab="plan" />;
}
