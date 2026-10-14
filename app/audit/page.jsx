// Route /audit · Old URL: redirects to /settings?tab=audit (Audit Log)
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Audit Logs · DVLA Skill Matrix & Assessment Platform',
};

export default function AuditPage() {
  return <AppRouter initialPage="audit" />;
}
