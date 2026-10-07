import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'User Management · DVLA Skill Matrix & Assessment Platform',
};

export default function UsersPage() {
  return <AppRouter initialPage="users" />;
}
