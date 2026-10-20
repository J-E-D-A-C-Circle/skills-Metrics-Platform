// Route /help · Help & Guides (and ?tab=ratings, Rating Scales) · drawn by components/SMHelp.jsx
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Help & Guides · DVLA Skill Matrix & Assessment Platform',
};

export default function HelpPage() {
  return <AppRouter initialPage="help" />;
}
