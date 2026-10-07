import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: '360° Feedback · DVLA Skill Matrix & Assessment Platform',
};

export default function FeedbackPage() {
  return <AppRouter initialPage="feedback" />;
}
