import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Individual Report · DVLA Skill Matrix & Assessment Platform',
};

export default function IndividualReportPage() {
  return <AppRouter initialPage="report" />;
}
