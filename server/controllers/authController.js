import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { cookieOptions } from '../middleware/auth.js';
import { getDefaultOrganization } from '../services/organizationService.js';
import EmployeeInvitation from '../models/EmployeeInvitation.js';
import { createHash } from 'node:crypto';
import { logActivity } from '../services/activityService.js';

const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email, role: user.role });
const issueSession = (user, res) => {
  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });
  res.cookie('bg_session', token, cookieOptions());
};

export async function registerEmployee(req, res, next) {
  try {
    if (process.env.EMPLOYEE_REGISTRATION_ENABLED !== 'true') return res.status(403).json({ message: 'Employee registration is currently closed. Ask your organisation administrator for access.' });
    const { name, email, password } = req.body;
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) return res.status(400).json({ message: 'Enter a name between 2 and 80 characters.' });
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (typeof password !== 'string' || password.length < 10 || password.length > 72 || Buffer.byteLength(password, 'utf8') > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return res.status(400).json({ message: 'Use at least 10 characters, including a letter and a number.' });
    const normalizedEmail = email.toLowerCase().trim();
    if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ message: 'An account with this email already exists.' });
    const passwordHash = await bcrypt.hash(password, 12);
    const organization = await getDefaultOrganization();
    const user = await User.create({ organizationId: organization._id, name: name.trim(), email: normalizedEmail, passwordHash, role: 'employee' });
    await logActivity({ organizationId: organization._id, actorId: user._id, action: 'employee.registered', entityType: 'user', entityId: user._id, summary: `${user.name} registered as an employee` });
    issueSession(user, res);
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.' });
    next(error);
  }
}


export async function acceptInvitation(req, res, next) {
  try {
    const { token, name, password } = req.body;
    if (typeof token !== 'string' || token.length < 32) return res.status(400).json({ message: 'This invitation link is invalid.' });
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) return res.status(400).json({ message: 'Enter a name between 2 and 80 characters.' });
    if (typeof password !== 'string' || password.length < 10 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return res.status(400).json({ message: 'Use at least 10 characters, including a letter and a number.' });
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invite = await EmployeeInvitation.findOne({ tokenHash, acceptedAt: null, expiresAt: { $gt: new Date() } });
    if (!invite) return res.status(410).json({ message: 'This invitation has expired or has already been used.' });
    if (await User.exists({ email: invite.email })) return res.status(409).json({ message: 'An account with this email already exists.' });
    const user = await User.create({ organizationId: invite.organizationId, name: name.trim(), email: invite.email, passwordHash: await bcrypt.hash(password, 12), role: 'employee' });
    invite.acceptedAt = new Date(); await invite.save();
    await logActivity({ organizationId: invite.organizationId, actorId: user._id, action: 'employee.registered', entityType: 'user', entityId: user._id, summary: `${user.name} joined via employee invitation` });
    issueSession(user, res);
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) { if (error?.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.' }); next(error); }
}

export async function login(req, res, next) {
  try {
    const { email, password, intendedRole } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || !['employee', 'admin'].includes(intendedRole)) return res.status(400).json({ message: 'Enter your email and password, then choose an account type.' });
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash name email role active');
    const valid = user && user.active && await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ message: 'The email or password is incorrect.' });
    if (user.role !== intendedRole) return res.status(403).json({ message: `This account is not registered as an ${intendedRole === 'admin' ? 'admin' : 'employee'}. Choose the correct sign-in option.` });
    issueSession(user, res);
    return res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
}

export async function me(req, res) { res.json({ user: publicUser(req.user) }); }
export async function logout(req, res) {
  const options = cookieOptions();
  delete options.maxAge;
  res.clearCookie('bg_session', options);
  return res.json({ message: 'You have been signed out.' });
}
