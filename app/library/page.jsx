import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Competency Library · DVLA Skill Matrix & Assessment Platform',
};

export default function LibraryPage() {
  return <AppRouter initialPage="library" />;
}
