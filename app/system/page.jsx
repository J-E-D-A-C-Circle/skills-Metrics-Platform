import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'System Settings · DVLA Skill Matrix & Assessment Platform',
};

export default function SystemPage() {
  return <AppRouter initialPage="system" />;
}
