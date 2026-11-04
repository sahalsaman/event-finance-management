import { login } from '@/app/actions';
import { auth } from '@/auth';
import { LoginErrorToast } from '@/components/LoginErrorToast';
import { SubmitButton } from '@/components/SubmitButton';
import { ClearStaleSession } from '@/components/ClearStaleSession';
import { db } from '@/lib/db';
import { User } from '@/models/User';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

export const instant = false;

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await connection();
  const sessionUser = (await auth())?.user;
  if (sessionUser?.id) {
    await db();
    const user = await User.findOne({ _id: sessionUser.id, active: true }).select('_id').lean();
    if (user) redirect('/');
    return <ClearStaleSession />;
  }
  const { error } = await searchParams;

  return (
    <main className="shell" style={{ maxWidth: 430, paddingTop: 85 }}>
      <LoginErrorToast
        message={
          error === 'invalid'
            ? 'Invalid email or password'
            : error === 'unavailable'
              ? 'Login is temporarily unavailable. Please try again later or contact support.'
              : null
        }
      />
      <div className="card stack">
        <div>
          <h1>SSF Mukkam Finance</h1>
          <p className="muted">Sign in to manage SSF Mukkam finances</p>
        </div>
        <form action={login}>
          <div className="field">
            <label>Email</label>
            <input name="email" type="email" required autoComplete="username" />
          </div>
          <div className="field">
            <label>Password</label>
            <input name="password" type="password" minLength={6} required autoComplete="current-password" />
          </div>
          <SubmitButton className="button" style={{ width: '100%' }} pendingText="Signing in...">Login</SubmitButton>
        </form>
        <a className="profile-support login-support" href="https://wa.me/918547929822" target="_blank" rel="noopener noreferrer">
          Help &amp; Support
        </a>
      </div>
    </main>
  );
}
