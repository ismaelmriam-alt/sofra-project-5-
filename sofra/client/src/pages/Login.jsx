import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthPageShell from '../components/AuthPageShell.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password to continue.');
      return;
    }

    setBusy(true);
    try {
      await login({ email: email.trim(), password });
      navigate(location.state?.from?.pathname || '/account', { replace: true });
    } catch (err) {
      setError(err.message || 'We could not sign you in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthPageShell
      eyebrow="Welcome back"
      storyTitle={<>Come back<br /><em>to the table.</em></>}
      storyText="A familiar table, your favorite dishes, and a little taste of Lebanon whenever you like."
      title="Welcome back"
      subtitle="Sign in to your SOFRA account."
      footer={<>New to SOFRA? <Link to="/register">Create an account</Link></>}
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <label className="auth-field">
          <span>Email address</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            autoFocus
            required
            maxLength={254}
            value={email}
            onChange={(event) => { setEmail(event.target.value); setError(''); }}
            placeholder="you@example.com"
          />
        </label>
        <label className="auth-field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => { setPassword(event.target.value); setError(''); }}
            placeholder="Enter your password"
          />
        </label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="btn btn-primary block auth-submit" disabled={busy}>
          {busy ? <><span className="spinner small" /> Signing in…</> : 'Sign in'}
        </button>
      </form>
    </AuthPageShell>
  );
}
