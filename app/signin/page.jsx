import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Sign In · DVLA Skill Matrix & Assessment Platform',
};

export default function SignInPage() {
  return <AppRouter initialPage="signin" />;
}
