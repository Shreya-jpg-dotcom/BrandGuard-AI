import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function AuthPage({ mode = 'login' }) {
  const isSignup = mode === 'signup';
  const [role,setRole] = useState('employee');
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const isInvited = Boolean(isSignup && inviteToken);
  const [name,setName] = useState('');
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [showPassword,setShowPassword] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const { user, login, register, acceptInvitation, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const signOutCurrentSession = async () => {
    try { await logout(); toast('You have been signed out. Please enter your credentials.'); }
    catch (err) { toast(err.message || 'Could not complete sign out. Please try again.', 'error'); }
  };
  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (isSignup && (name.trim().length < 2 || password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password))) { setError('Use a name with at least 2 characters and a password of 10+ characters containing a letter and a number.'); return; }
    setBusy(true);
    try {
      const account = isSignup ? (isInvited ? await acceptInvitation({ token: inviteToken, name, password }) : await register({ name, email, password })) : await login({ email, password, intendedRole: role });
      toast(isSignup ? 'Your employee account has been created.' : 'Welcome back. You are signed in.');
      navigate(account.role === 'admin' ? '/admin' : '/workspace', { replace: true });
    } catch (err) { setError(err.message); toast(err.message, 'error'); }
    finally { setBusy(false); }
  };
  return <div className="auth-page"><div className="auth-photo"/><div className="auth-shade"/><div className="auth-top"><BrandMark light/><Link to="/" className="back-home"><ArrowLeft size={15}/> Back to home</Link></div><div className="auth-layout"><motion.div className="auth-story" initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{duration:.7}}><span className="eyebrow">THE STANDARD BEHIND YOUR STORY</span><h1>{isSignup?<>Make room for<br/><em>better work.</em></>:<>Your brand,<br/><em>in good hands.</em></>}</h1><p>{isSignup?'Join your organisation’s workspace and bring more clarity to every draft.':'A considered checkpoint between the first draft and the world.'}</p><div className="auth-assurance"><ShieldCheck size={17}/><span>Human decisions. Clear accountability.</span></div></motion.div><motion.div className="auth-panel" initial={{opacity:0,x:24}} animate={{opacity:1,x:0}} transition={{duration:.65,delay:.12}}><div className="auth-panel-head"><span className="eyebrow">{isSignup?'CREATE YOUR ACCOUNT':'SECURE WORKSPACE ACCESS'}</span><h2>{isSignup?(isInvited?'Accept your invitation':'Create an employee account'):'Welcome back'}</h2><p>{isSignup?(isInvited?'Set up your invited employee account.':'Your access is tied to your employee role.'):'Choose how you access BrandGuard.'}</p></div>{user&&<div className="active-session-notice"><div><strong>Already signed in</strong><span>{user.email} · {user.role}</span></div><button type="button" onClick={signOutCurrentSession}>Sign out first</button></div>}{!isSignup&&<div className="role-switch" role="group" aria-label="Account type"><button className={role==='employee'?'selected':''} onClick={()=>setRole('employee')} type="button"><UserRound size={17}/> Employee</button><button className={role==='admin'?'selected':''} onClick={()=>setRole('admin')} type="button"><LockKeyhole size={17}/> Admin</button></div>}{isSignup&&<div className="signup-role-note"><UserRound size={17}/><span>Employee registration <small>Admin accounts are provisioned securely by an authorised process.</small></span></div>}{!(user && isSignup) && <form onSubmit={submit} className="auth-form">{isSignup&&<label>Full name<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="Your name" required minLength={2} maxLength={80}/></label>}{!isInvited&&<label>Work email<input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@company.com" required/></label>}<label>Password<span className="password-wrap"><input value={password} onChange={e=>setPassword(e.target.value)} type={showPassword?'text':'password'} autoComplete={isSignup?'new-password':'current-password'} placeholder={isSignup?'At least 10 characters':'Enter your password'} required/><button type="button" aria-label={showPassword?'Hide password':'Show password'} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></span>{isSignup&&<small className="field-hint">At least 10 characters, including a letter and a number.</small>}</label>{error&&<div className="form-error" role="alert">{error}</div>}<button className="button button-copper auth-submit" type="submit" disabled={busy}>{busy?'Please wait…':isSignup?(isInvited?'Accept invitation':'Create employee account'):'Continue securely'} {!busy&&<ArrowRight size={16}/>}</button></form>}{user && isSignup && <p className="session-form-hint">Sign out of the current account before creating or accepting another account.</p>}<div className="auth-switch">{isSignup?'Already have access?':'New to your organisation?'} <Link to={isSignup?'/signin':'/signup'}>{isSignup?'Sign in':'Create employee account'}</Link></div><div className="auth-legal"><LockKeyhole size={13}/> Your session is protected with an HTTP-only secure cookie.</div></motion.div></div><div className="auth-footer"><span>© {new Date().getFullYear()} BrandGuard</span><span>CONFIDENTIAL WORKSPACE ACCESS</span></div></div>;
}
