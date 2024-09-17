import { Request, Response } from 'express';
import { getProducersQuery } from '../services/producerService';
import { scoreDescriptions } from '../utils/scoreDescriptions';
import { config } from '../config/env';

export const renderProducersPage = async (req: Request, res: Response) => {
    try {
        const chain = (req.query.chain as 'Mainnet' | 'Testnet') || 'Mainnet';
        const producers = await getProducersQuery(undefined, chain, 'score');
        const combinedScoringCriteria = {
            ...config.scoringCriteria,
            ...config.mainnetScoringCriteria
        };
        res.render('producers', {
            producers,
            scoreDescriptions,
            scoringCriteria: combinedScoringCriteria,
            chain
        });
    } catch (error) {
        console.error('Error rendering producers page:', error);
        res.status(500).send('An error occurred while rendering the producers page.');
    }
};