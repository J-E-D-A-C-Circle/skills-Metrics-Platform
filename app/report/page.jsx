// Route /report · Individual staff report, /report?id=<staffId> · drawn by components/SMStaffReport.jsx
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Individual Report · DVLA Skill Matrix & Assessment Platform',
};

export default function IndividualReportPage() {
  return <AppRouter initialPage="report" />;
}
