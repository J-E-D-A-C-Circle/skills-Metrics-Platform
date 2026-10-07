import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Target Profiles · DVLA Skill Matrix & Assessment Platform',
};

export default function TargetsPage() {
  return <AppRouter initialPage="targets" />;
}
