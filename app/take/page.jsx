// Route /take · Take an assessment, /take?id=<assessment id> (participants only, no countdown timer) · drawn by components/SMTake.jsx
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Take Assessment · DVLA Skill Matrix & Assessment Platform',
};

export default function TakeAssessmentPage() {
  return <AppRouter initialPage="take" />;
}
