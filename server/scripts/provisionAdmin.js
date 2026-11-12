import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { getDefaultOrganization } from '../services/organizationService.js';

const { MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!MONGODB_URI || !ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('Set MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in server/.env before provisioning.');
if (ADMIN_PASSWORD.length < 14 || ADMIN_PASSWORD.length > 72 || Buffer.byteLength(ADMIN_PASSWORD, 'utf8') > 72 || !/[A-Z]/.test(ADMIN_PASSWORD) || !/[a-z]/.test(ADMIN_PASSWORD) || !/\d/.test(ADMIN_PASSWORD) || !/[^A-Za-z0-9]/.test(ADMIN_PASSWORD)) throw new Error('ADMIN_PASSWORD must be 14+ characters with upper, lower, number and symbol.');
await mongoose.connect(MONGODB_URI);
const organization = await getDefaultOrganization();
try {
  const existingAdmin = await User.exists({ role: 'admin', organizationId: organization._id });
  if (existingAdmin) throw new Error('An admin already exists. Use an authorised admin-management process instead.');
  const email = ADMIN_EMAIL.toLowerCase().trim();
  if (await User.exists({ email })) throw new Error('This email already belongs to an account.');
  await User.create({ name: ADMIN_NAME.trim(), email, passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12), role: 'admin', organizationId: organization._id });
  console.info(`Initial admin provisioned: ${email}`);
} finally { await mongoose.disconnect(); }
