import express from 'express';
import path from 'path';
import { config } from './config/env';
import apiRoutes from './routes/publicApiRoutes';
import { logger_log } from './utils/logger';

// Cron setup
import './utils/cronJob';

// Express setup
const app = express();
app.use(express.json());
app.use('/api/', apiRoutes);
app.use(express.static(path.join(__dirname, '../public')));
const PORT = config.port;
app.listen(PORT, () => {
    logger_log('APP',`Server is running on port ${PORT}`);
});
