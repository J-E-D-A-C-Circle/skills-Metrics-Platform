import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Assessment Cycles · DVLA Skill Matrix & Assessment Platform',
};

export default function BuilderPage() {
  return <AppRouter initialPage="builder" />;
}
