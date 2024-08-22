import { Request, Response } from 'express';
import { getBundlesQuery } from '../services/bundleService';
import { logger_error } from '../utils/logger';

export const getBundles = async (req: Request, res: Response) => {
    try {
        const { chain } = req.query;
        const chainValue = chain as 'mainnet' | 'testnet' | undefined;

        const bundles = await getBundlesQuery(chainValue);
        res.json(bundles);
    } catch (error) {
        logger_error('BUNDLES', 'Error in getBundleVotes:', error);
        res.status(500).json({ error: 'An error occurred while fetching bundle votes.' });
    }
};