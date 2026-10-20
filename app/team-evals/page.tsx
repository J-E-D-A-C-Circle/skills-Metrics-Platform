// Route /team-evals · Old URL: redirects to /staff-evals
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Staff Evaluations · DVLA Skill Matrix & Assessment Platform',
};

export default function TeamEvalsPage() {
  return <AppRouter initialPage="team-evals" />;
}
