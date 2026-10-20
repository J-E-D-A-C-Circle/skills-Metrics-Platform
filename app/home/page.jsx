// Route /home · Home (same as /) · drawn by components/SMDashboard.jsx
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Home · DVLA Skill Matrix & Assessment Platform',
};

export default function HomePage() {
  return <AppRouter initialPage="home" />;
}
