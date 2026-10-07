import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Audit Logs · DVLA Skill Matrix & Assessment Platform',
};

export default function AuditPage() {
  return <AppRouter initialPage="audit" />;
}
