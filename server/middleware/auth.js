import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.bg_session;
    if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select('name email role active organizationId');
    if (!user || !user.active) return res.status(401).json({ message: 'Your session is no longer valid.' });
    req.user = user;
    next();
  } catch {
    res.clearCookie('bg_session', cookieOptions());
    return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: 'You do not have permission to access this resource.' });
    next();
  };
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {})
  };
}
