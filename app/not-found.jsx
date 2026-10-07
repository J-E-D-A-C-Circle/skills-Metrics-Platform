import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Page Not Found · DVLA Skill Matrix & Assessment Platform',
};

export default function NotFound() {
  return <AppRouter initialPage="home" />;
}
