import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#1A1714', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <SignUp routing="hash" signInUrl="/sign-in" fallbackRedirectUrl="/pricing" />
    </div>
  );
}
