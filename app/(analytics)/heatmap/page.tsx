// Route /heatmap · Old URL: redirects to /analytics?tab=heatmap
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Skill Heatmap · DVLA Skill Matrix & Assessment Platform',
};

export default function HeatmapPage() {
  return <AppRouter initialPage="heatmap" />;
}
