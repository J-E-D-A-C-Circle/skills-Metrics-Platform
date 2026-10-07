import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Skill Matrix & Assessment Platform · DVLA',
};

export default function Page() {
  return <AppRouter initialPage="home" />;
}
