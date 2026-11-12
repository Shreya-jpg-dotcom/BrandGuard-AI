import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['employee', 'admin'], default: 'employee', immutable: true },
  active: { type: Boolean, default: true }
}, { timestamps: true, versionKey: false });

export default mongoose.model('User', userSchema);
