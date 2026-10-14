// Route /approvals · Old URL: redirects to /staff-evals?tab=approvals (Plan Approvals)
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Plan Approvals · DVLA Skill Matrix & Assessment Platform',
};

export default function ApprovalsPage() {
  return <AppRouter initialPage="approvals" />;
}
