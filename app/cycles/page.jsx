import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Assessment Cycles · DVLA Skill Matrix & Assessment Platform',
};

export default function AssessmentCyclesPage() {
  return <AppRouter initialPage="cycles" />;
}
