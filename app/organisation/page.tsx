// Route /organisation · Organisation (Staff Records / Departments / Grades / Stations / Supervisors tabs) · drawn by components/SMOrganisation.jsx
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Organisation · DVLA Skill Matrix & Assessment Platform',
};

export default function OrganisationPage() {
  return <AppRouter initialPage="organisation" />;
}
