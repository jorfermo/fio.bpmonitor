import express from 'express';
import path from 'path';
import { config } from './config/env';
import apiRoutes from './routes/publicApiRoutes';
import viewRoutes from './routes/viewRoutes';
import { logger_log } from './utils/logger';

// Cron setup
import './utils/cronJob';

// Express setup
const app = express();
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/api/', apiRoutes);
app.use('/', viewRoutes);
app.use(express.static(path.join(__dirname, '../public')));
const PORT = config.port;
app.listen(PORT, () => {
    logger_log('APP',`Server is running on port ${PORT}`);
});