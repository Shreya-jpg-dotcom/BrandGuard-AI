import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import BrandMark from '../components/BrandMark';
export default function NotFoundPage() { return <div className="not-found"><div className="not-found-top"><BrandMark light/></div><div className="not-found-content"><Compass size={38}/><span className="eyebrow">404 / PAGE NOT FOUND</span><h1>This page is<br/><em>off the record.</em></h1><p>The address may have changed, or the page may not exist.</p><Link to="/" className="button button-copper"><ArrowLeft size={15}/> Return home</Link></div></div>; }
