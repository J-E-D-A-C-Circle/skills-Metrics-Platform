import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Plan Approvals · DVLA Skill Matrix & Assessment Platform',
};

export default function ApprovalsPage() {
  return <AppRouter initialPage="approvals" />;
}
