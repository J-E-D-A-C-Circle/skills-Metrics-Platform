// Route /staff-evals · Staff Evaluations (Reviews / 360° Feedback / Plan Approvals tabs) · drawn by components/SMStaffEvals.jsx
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Staff Evaluations · DVLA Skill Matrix & Assessment Platform',
};

export default function StaffEvaluationsPage() {
  return <AppRouter initialPage="staff-evals" />;
}
