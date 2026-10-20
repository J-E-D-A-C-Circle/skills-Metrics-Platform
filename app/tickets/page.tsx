// Route /tickets · Support Tickets · drawn by components/SMTickets.jsx
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Support Tickets · DVLA Skill Matrix & Assessment Platform',
};

export default function TicketsPage() {
  return <AppRouter initialPage="tickets" />;
}
