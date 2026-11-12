import mongoose from 'mongoose';
import { getDefaultOrganization, attachLegacyUsers } from '../services/organizationService.js';

export async function connectDatabase() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured.');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const organization = await getDefaultOrganization();
  await attachLegacyUsers(organization);
  console.info('MongoDB connected.');
}
