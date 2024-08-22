import { Request, Response } from 'express';
import { getProposalQuery } from '../services/proposalService';
import { logger_error } from '../utils/logger';

export const getProposals = async (req: Request, res: Response) => {
    try {
        const { limit, chain } = req.query;
        const limitNumber = limit ? parseInt(limit as string, 10) : undefined;
        const chainValue = chain as 'mainnet' | 'testnet' | undefined;

        const proposals = await getProposalQuery(limitNumber, chainValue);
        res.json(proposals);
    } catch (error) {
        logger_error('PROPOSALS', 'Error in getProposals:', error);
        res.status(500).json({ error: 'An error occurred while fetching proposals.' });
    }
};