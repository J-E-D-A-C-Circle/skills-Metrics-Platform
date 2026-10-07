import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Form Builder · DVLA Skill Matrix & Assessment Platform',
};

export default function FormsPage() {
  return <AppRouter initialPage="forms" />;
}
