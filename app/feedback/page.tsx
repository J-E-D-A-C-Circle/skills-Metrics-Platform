// Route /feedback · Old URL: redirects to /staff-evals?tab=feedback (360° Feedback)
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: '360° Feedback · DVLA Skill Matrix & Assessment Platform',
};

export default function FeedbackPage() {
  return <AppRouter initialPage="feedback" />;
}
