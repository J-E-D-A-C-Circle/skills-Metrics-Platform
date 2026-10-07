import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Rating Scales · DVLA Skill Matrix & Assessment Platform',
};

export default function ScalesPage() {
  return <AppRouter initialPage="scales" />;
}
