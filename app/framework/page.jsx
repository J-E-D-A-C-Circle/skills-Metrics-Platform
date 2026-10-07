import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Skill Framework · DVLA Skill Matrix & Assessment Platform',
};

export default function FrameworkPage() {
  return <AppRouter initialPage="framework" />;
}
