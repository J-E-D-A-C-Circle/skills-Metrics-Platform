// Route /signin · Sign-in screen · drawn by components/SMSignIn.jsx
// Every route file just mounts components/AppRouter.jsx; the URL decides what SkillMatrixApp shows.
import AppRouter from '@/components/AppRouter';

export const metadata = {
  title: 'Sign In · DVLA Skill Matrix & Assessment Platform',
};

export default function SignInPage() {
  return <AppRouter initialPage="signin" />;
}
