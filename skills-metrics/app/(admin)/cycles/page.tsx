// Route /cycles · Assignments & Deadlines · drawn by components/SMAssignments.jsx
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Assessment Cycles · DVLA Skill Matrix & Assessment Platform',
};

export default function AssessmentCyclesPage() {
  return <AppRouter initialPage="cycles" />;
}
