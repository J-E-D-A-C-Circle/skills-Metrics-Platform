// Route /profile · My Profile (Account / Skills / History tabs) · drawn by components/SMProfile.jsx
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'My Profile · DVLA Skill Matrix & Assessment Platform',
};

export default function ProfilePage() {
  return <AppRouter initialPage="profile" />;
}
