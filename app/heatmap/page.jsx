import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Skill Heatmap · DVLA Skill Matrix & Assessment Platform',
};

export default function HeatmapPage() {
  return <AppRouter initialPage="heatmap" />;
}
