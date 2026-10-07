import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Help & Guides · DVLA Skill Matrix & Assessment Platform',
};

export default function HelpPage() {
  return <AppRouter initialPage="help" />;
}
