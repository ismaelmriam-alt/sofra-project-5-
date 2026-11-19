import { Link } from 'react-router-dom';
import { Reveal, WordReveal } from './Reveal.jsx';
import Decor from './Decor.jsx';

export default function ReservationCTA() {
  return (
    <section className="reservation-promo">
      <Decor kind="lantern" size={44} className="reservation-promo-decor" depth={14} delay={0.2} />
      <div className="container reservation-promo-inner">
        <div>
          <p className="eyebrow">A place at our table</p>
          <WordReveal text="Gather around something good." />
          <Reveal as="p" delay={0.12}>Make room for a meal worth sharing. Choose a date and time that works for your party.</Reveal>
        </div>
        <Reveal delay={0.2}>
          <Link className="btn btn-primary" to="/reservations">Book a Table</Link>
        </Reveal>
      </div>
    </section>
  );
}
