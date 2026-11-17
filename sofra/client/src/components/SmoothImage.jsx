import { useEffect, useState } from 'react';
import { CedarMark } from './Logo.jsx';

// <img> with lazy loading and a fade-in. If there is no photo (or the URL fails),
// it shows an honest typographic card — never an unrelated or fake image.
export default function SmoothImage({ src, alt, name, className = '', eager = false, ...rest }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setFailed(false); setLoaded(false); }, [src]);

  if (!src || failed) {
    return (
      <div className={`photo-missing ${className}`} role="img" aria-label={alt}>
        <CedarMark size={26} color="currentColor" />
        <span>{name || alt}</span>
        <em className="soon">Photo coming soon</em>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={`smooth-img ${loaded ? 'is-loaded' : ''} ${className}`}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      {...rest}
    />
  );
}
