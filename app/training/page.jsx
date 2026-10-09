import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Training Needs · DVLA Skill Matrix & Assessment Platform',
};

export default function TrainingNeedsPage() {
  return <AppRouter initialPage="training" />;
}
