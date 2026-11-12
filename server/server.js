import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { connectDatabase } from './config/db.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import employeeRoutes from './routes/employee.js';
import documentRoutes from './routes/documents.js';
import knowledgeRoutes from './routes/knowledge.js';
import analysisRoutes from './routes/analyses.js';
import conversationRoutes from './routes/conversations.js';
import correctionRoutes from './routes/corrections.js';
import versionRoutes from './routes/versions.js';
import reviewRoutes from './routes/reviews.js';
import insightsRoutes from './routes/insights.js';
import { errorHandler, notFound } from './utils/errors.js';

const app = express();
const port = Number(process.env.PORT || 5000);
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.');
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'BrandGuard API' }));
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', insightsRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api', analysisRoutes);
app.use('/api', conversationRoutes);
app.use('/api', correctionRoutes);
app.use('/api', versionRoutes);
app.use('/api', reviewRoutes);
app.use('/api/brands/default/knowledge', knowledgeRoutes);
app.use(notFound);
app.use(errorHandler);

try {
  await connectDatabase();
  app.listen(port, '0.0.0.0', () => console.info(`BrandGuard API listening on ${port}`));
} catch (error) {
  console.error(`Startup failed: ${error.message}`);
  process.exit(1);
}
