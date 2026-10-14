// Route /assessments · My Assessments list · drawn by components/SMAssessments.jsx
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'My Assessments · DVLA Skill Matrix & Assessment Platform',
};

export default function AssessmentsPage() {
  return <AppRouter initialPage="assessments" />;
}
