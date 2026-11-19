import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function MyAccount() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    refreshUser()
      .then(() => { if (active) setError(''); })
      .catch((err) => { if (active) setError(err.message || 'Could not refresh your account details.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshUser]);

  return (
    <main className="page account-page">
      <div className="container narrow">
        <p className="eyebrow">SOFRA · YOUR ACCOUNT</p>
        <h1 className="account-title">My account</h1>
        <p className="account-intro">Welcome to your place at the SOFRA table.</p>

        <section className="account-card" aria-labelledby="account-details">
          <div className="account-card-heading">
            <span className="account-initial" aria-hidden="true">{user?.name?.trim()?.[0]?.toUpperCase() || 'S'}</span>
            <div>
              <span className="auth-card-kicker">ACCOUNT DETAILS</span>
              <h2 id="account-details">{user?.name || 'Your account'}</h2>
            </div>
          </div>
          <dl className="account-details">
            <div><dt>Name</dt><dd>{user?.name}</dd></div>
            <div><dt>Email address</dt><dd>{user?.email}</dd></div>
          </dl>
          <p className="auth-privacy">For privacy, your sign-in stays in memory and ends when this page is refreshed or the tab is closed.</p>
          {loading && <p className="account-status"><span className="spinner small" /> Checking your account…</p>}
          {error && <p className="auth-error" role="alert">{error}</p>}
        </section>

        <div className="account-actions">
          <Link to="/menu" className="btn btn-primary">Explore the menu</Link>
        </div>
      </div>
    </main>
  );
}
