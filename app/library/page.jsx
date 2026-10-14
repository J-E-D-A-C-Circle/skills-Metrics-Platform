// Route /library · Old URL: redirects to /framework?tab=competencies
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Competency Library · DVLA Skill Matrix & Assessment Platform',
};

export default function LibraryPage() {
  return <AppRouter initialPage="library" />;
}
