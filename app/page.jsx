// Route / · Home page (participant/manager Home or admin Home) · drawn via components/AppRouter.jsx
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Skill Matrix & Assessment Platform · DVLA',
};

export default function Page() {
  return <AppRouter initialPage="home" />;
}
