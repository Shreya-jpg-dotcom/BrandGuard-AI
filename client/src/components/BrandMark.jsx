import { Link } from 'react-router-dom';
export default function BrandMark({ light = false, compact = false }) {
  return <Link to="/" className={`brand-mark ${light ? 'brand-mark-light' : ''}`} aria-label="BrandGuard home"><span className="brand-symbol"><svg viewBox="0 0 34 34" aria-hidden="true"><path d="M7 5h12c7 0 11 3.5 11 9 0 3.3-1.8 5.7-5.1 7 3.9 1 6.1 3.5 6.1 7 0 6-4.5 9-12 9H7V5Z" fill="currentColor"/><path d="M13 11h6c2.5 0 4 1.2 4 3.3s-1.5 3.2-4 3.2h-6v-6.5Zm0 12h7c2.7 0 4.2 1.1 4.2 3.3S22.7 30 20 30h-7v-7Z" fill="#211816" transform="translate(0 -3)"/></svg></span>{!compact && <span className="brand-wordmark">brandguard<span>®</span><small>BRAND GOVERNANCE</small></span>}</Link>;
}
