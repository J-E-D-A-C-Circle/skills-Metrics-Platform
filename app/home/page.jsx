import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Home · DVLA Skill Matrix & Assessment Platform',
};

export default function HomePage() {
  return <AppRouter initialPage="home" />;
}
