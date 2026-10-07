import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'My Profile · DVLA Skill Matrix & Assessment Platform',
};

export default function ProfilePage() {
  return <AppRouter initialPage="profile" />;
}
