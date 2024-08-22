import { Request, Response } from "express";
import { getNodesQuery } from "../services/nodeService";

export const getNodes = async (req: Request, res: Response) => {
    try {
        const { chain, type } = req.query;
        const chainValue = chain as 'mainnet' | 'testnet' | undefined;
        const typeValue = type as 'api' | 'seed' | 'producer' | undefined;

        const nodes = await getNodesQuery(chainValue, typeValue);
        res.json(nodes);
    } catch (error) {
        console.error('Error in getNodes:', error);
        res.status(500).json({ error: 'An error occurred while fetching nodes.' });
    }
};