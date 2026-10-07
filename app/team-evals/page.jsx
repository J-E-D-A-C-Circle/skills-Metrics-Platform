import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Team Evaluations · DVLA Skill Matrix & Assessment Platform',
};

export default function TeamEvalsPage() {
  return <AppRouter initialPage="team-evals" />;
}
