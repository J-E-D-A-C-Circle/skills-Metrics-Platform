import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Evidence & Certifications · DVLA Skill Matrix & Assessment Platform',
};

export default function EvidencePage() {
  return <AppRouter initialPage="evidence" />;
}
