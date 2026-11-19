import Logo, { CedarMark } from './Logo.jsx';

export default function AuthPageShell({ eyebrow, storyTitle, storyText, title, subtitle, footer, children }) {
  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-story" aria-label="Sofra">
          <Logo light />
          <div className="auth-story-copy">
            <p className="eyebrow light">{eyebrow}</p>
            <h1>{storyTitle}</h1>
            <p>{storyText}</p>
          </div>
          <div className="auth-seal" aria-hidden="true">
            <span />
            <CedarMark size={54} color="#D6AE55" />
          </div>
          <span className="auth-story-foot">Lebanese hospitality, at your table</span>
        </section>

        <section className="auth-card" aria-labelledby="auth-heading">
          <header className="auth-card-head">
            <span className="auth-card-kicker">SOFRA · YOUR ACCOUNT</span>
            <h2 id="auth-heading">{title}</h2>
            <p>{subtitle}</p>
          </header>
          {children}
          <div className="auth-card-foot">{footer}</div>
        </section>
      </div>
    </main>
  );
}
