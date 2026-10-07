import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'My Assessments · DVLA Skill Matrix & Assessment Platform',
};

export default function AssessmentsPage() {
  return <AppRouter initialPage="assessments" />;
}
