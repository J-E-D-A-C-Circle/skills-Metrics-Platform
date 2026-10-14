// Route /framework · Skill Framework (Competencies / Target Profiles / Rating Scales) · drawn by components/SMFramework.jsx
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Skill Framework · DVLA Skill Matrix & Assessment Platform',
};

export default function FrameworkPage() {
  return <AppRouter initialPage="framework" />;
}
