import Organization from '../models/Organization.js';
import User from '../models/User.js';
export async function getDefaultOrganization() {
  let organization = await Organization.findOne({ slug: 'default-workspace' });
  if (!organization) organization = await Organization.create({ name: process.env.DEFAULT_ORG_NAME || 'BrandGuard Workspace', slug: 'default-workspace' });
  return organization;
}
export async function attachLegacyUsers(organization) {
  await User.updateMany({ organizationId: { $exists: false } }, { $set: { organizationId: organization._id } });
}
