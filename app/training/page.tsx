// Route /training · Development Priorities (All / Top Training Needs tabs) · drawn by components/SMPriorities.jsx
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Training Needs · DVLA Skill Matrix & Assessment Platform',
};

export default function TrainingNeedsPage() {
  return <AppRouter initialPage="training" />;
}
