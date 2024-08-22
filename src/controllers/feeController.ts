import { Request, Response } from 'express';
import { getFeesQuery } from '../services/feeService';
import { logger_error } from '../utils/logger';

export const getFees = async (req: Request, res: Response) => {
    try {
        const { chain, type } = req.query;
        const chainValue = chain as 'mainnet' | 'testnet' | undefined;
        const typeValue = type as 'by_producer' | 'by_fee' | undefined;

        const fees = await getFeesQuery(chainValue, typeValue);
        res.json(fees);
    } catch (error) {
        logger_error('FEES', 'Error in getFees:', error);
        res.status(500).json({ error: 'An error occurred while fetching fees.' });
    }
};