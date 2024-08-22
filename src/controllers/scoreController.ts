import { Request, Response } from 'express';
import { getScoresQuery } from '../services/scoringService';
import { logger_error } from '../utils/logger';

export const getScores = async (req: Request, res: Response) => {
    try {
        const { limit, chain } = req.query;
        const limitNumber = limit ? parseInt(limit as string, 10) : undefined;
        const chainValue = chain as 'mainnet' | 'testnet' | undefined;

        const scores = await getScoresQuery(limitNumber, chainValue);
        res.json(scores);
    } catch (error) {
        logger_error('SCORES', 'Error in getScores:', error);
        res.status(500).json({ error: 'An error occurred while fetching scores.' });
    }
};