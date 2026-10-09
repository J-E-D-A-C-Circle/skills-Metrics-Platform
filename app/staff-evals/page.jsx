import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Staff Evaluations · DVLA Skill Matrix & Assessment Platform',
};

export default function StaffEvaluationsPage() {
  return <AppRouter initialPage="staff-evals" />;
}
