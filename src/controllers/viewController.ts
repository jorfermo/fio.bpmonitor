import { Request, Response } from 'express';
import { getProducersQuery } from '../services/producerService';
import { scoreDescriptions } from '../utils/scoreDescriptions';
import { config } from '../config/env';
import path from 'path';

export const renderProducersPage = async (req: Request, res: Response) => {
    try {
        const producers = await getProducersQuery();
        res.render('producers', { producers, scoreDescriptions, scoringCriteria: config.scoringCriteria });
    } catch (error) {
        console.error('Error rendering producers page:', error);
        res.status(500).send('An error occurred while rendering the producers page.');
    }
};