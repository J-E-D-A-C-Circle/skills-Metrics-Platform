import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Development Plan · DVLA Skill Matrix & Assessment Platform',
};

export default function PlanPage() {
  return <AppRouter initialPage="profile" initialTab="plan" />;
}
