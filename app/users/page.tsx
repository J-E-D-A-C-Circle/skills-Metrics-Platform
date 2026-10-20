// Route /users · Old URL: redirects to /settings?tab=users (User Management)
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Settings · DVLA Skill Matrix & Assessment Platform',
};

export default function UsersPage() {
  return <AppRouter initialPage="users" />;
}
