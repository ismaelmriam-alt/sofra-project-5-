import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthPageShell from '../components/AuthPageShell.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!name.trim() || !email.trim() || !password) {
      setError('Please complete each field.');
      return;
    }
    if (password.length < 8) {
      setError('Your password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Your passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await register({ name: name.trim(), email: email.trim(), password });
      navigate(location.state?.from?.pathname || '/account', { replace: true });
    } catch (err) {
      const details = Object.values(err.details || {}).filter(Boolean);
      setError(details[0] || err.message || 'We could not create your account. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthPageShell
      eyebrow="Pull up a chair"
      storyTitle={<>Good food is<br /><em>better shared.</em></>}
      storyText="Create your account to keep your SOFRA experience close, from the first browse to the last bite."
      title="Join our table"
      subtitle="Create your SOFRA account in just a moment."
      footer={<>Already have an account? <Link to="/login">Sign in</Link></>}
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <label className="auth-field">
          <span>Your name</span>
          <input
            type="text"
            name="name"
            autoComplete="name"
            autoFocus
            required
            maxLength={80}
            value={name}
            onChange={(event) => { setName(event.target.value); setError(''); }}
            placeholder="How should we greet you?"
          />
        </label>
        <label className="auth-field">
          <span>Email address</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => { setEmail(event.target.value); setError(''); }}
            placeholder="you@example.com"
          />
        </label>
        <div className="auth-form-row">
          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              name="new-password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => { setPassword(event.target.value); setError(''); }}
              placeholder="At least 8 characters"
            />
          </label>
          <label className="auth-field">
            <span>Confirm password</span>
            <input
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(event) => { setConfirmPassword(event.target.value); setError(''); }}
              placeholder="Re-enter password"
            />
          </label>
        </div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="btn btn-primary block auth-submit" disabled={busy}>
          {busy ? <><span className="spinner small" /> Creating account…</> : 'Create account'}
        </button>
        <p className="auth-privacy">Your password is never saved in this browser. You can sign in securely whenever you return.</p>
      </form>
    </AuthPageShell>
  );
}
