import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#1A1714', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <SignIn routing="hash" signUpUrl="/sign-up" fallbackRedirectUrl="/viewer" />
    </div>
  );
}
