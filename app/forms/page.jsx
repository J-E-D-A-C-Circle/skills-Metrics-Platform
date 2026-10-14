// Route /forms · Forms library and builder · drawn by components/SMFormBuilder.jsx
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Form Builder · DVLA Skill Matrix & Assessment Platform',
};

export default function FormsPage() {
  return <AppRouter initialPage="forms" />;
}
