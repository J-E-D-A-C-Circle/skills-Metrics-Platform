import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Take Assessment · DVLA Skill Matrix & Assessment Platform',
};

export default function TakeAssessmentPage() {
  return <AppRouter initialPage="take" />;
}
