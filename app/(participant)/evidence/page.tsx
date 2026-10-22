// Route /evidence · Old URL: redirects to /profile?tab=evidence
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Evidence & Certifications · DVLA Skill Matrix & Assessment Platform',
};

export default function EvidencePage() {
  return <AppRouter initialPage="evidence" />;
}
