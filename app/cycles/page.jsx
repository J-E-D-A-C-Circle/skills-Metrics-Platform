// Route /cycles · Assessment Cycles (admin) · drawn by components/SMCycles.jsx
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Assessment Cycles · DVLA Skill Matrix & Assessment Platform',
};

export default function AssessmentCyclesPage() {
  return <AppRouter initialPage="cycles" />;
}
