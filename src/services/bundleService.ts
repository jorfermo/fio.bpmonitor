import { prisma } from '../config/database';
import { config } from '../config/env';
import { logger_log, logger_error } from '../utils/logger';
import axios from 'axios';

interface BundleVote {
    block_producer_name: string;
    bundledbvotenumber: number;
    lastvotetimestamp: number;
}

// Queries db for active producers' bundle votes
export const getBundlesQuery = async (chainValue: 'mainnet' | 'testnet' = 'mainnet') => {
    const chain = chainValue === 'mainnet' ? 'Mainnet' : 'Testnet';

    const producers = await prisma.producer.findMany({
        where: {
            chain,
            bundleVotes: {
                isNot: null
            }
        },
        select: {
            owner: true,
            bundleVotes: {
                select: {
                    bundledbvotenumber: true,
                    lastvotetimestamp: true
                }
            }
        }
    });

    return producers.map(producer => ({
        producer: producer.owner,
        bundledbvotenumber: producer.bundleVotes?.bundledbvotenumber ?? null,
        lastvotetimestamp: producer.bundleVotes?.lastvotetimestamp ?? null
    }));
};

// Triggers Bundle votes fetch and processing for Mainnet and Testnet
export async function triggerBundleFetch() {
    try {
        const chains = ['Mainnet', 'Testnet'];
        const apiUrls = [config.mainnetApiUrl, config.testnetApiUrl];

        for (let i = 0; i < chains.length; i++) {
            const chain = chains[i];
            const apiUrl = apiUrls[i];

            await fetchBundleVotes(chain, apiUrl);
        }
    } catch (error) {
        logger_error('BUNDLES', 'Catch all error in triggerBundleFetch() ', error);
    }
    logger_log('BUNDLES', 'Done updating bundles.');
}

// Fetches and processes individual bundle votes
async function fetchBundleVotes(chain: string, apiUrl: string) {
    try {
        logger_log('BUNDLES', `Fetching bundle votes for ${chain} from ${apiUrl}`);
        const response = await axios.post<{ rows: BundleVote[], more: boolean }>(`${apiUrl}/v1/chain/get_table_rows`, {
            json: true,
            code: "fio.fee",
            scope: "fio.fee",
            table: "bundlevoters",
            limit: "5000"
        });

        const returnedProducerIds = new Set<number>();

        for (const bundleVote of response.data.rows) {
            const producer = await prisma.producer.findFirst({
                where: { owner: bundleVote.block_producer_name, chain }
            });

            if (producer) {
                returnedProducerIds.add(producer.id);
                await prisma.producerBundleVotes.upsert({
                    where: { producerId: producer.id },
                    update: {
                        bundledbvotenumber: bundleVote.bundledbvotenumber,
                        lastvotetimestamp: new Date(bundleVote.lastvotetimestamp * 1000)
                    },
                    create: {
                        producerId: producer.id,
                        bundledbvotenumber: bundleVote.bundledbvotenumber,
                        lastvotetimestamp: new Date(bundleVote.lastvotetimestamp * 1000)
                    }
                });
            }
        }

        // Remove bundle votes for producers not returned by the API
        await prisma.producerBundleVotes.deleteMany({
            where: {
                producer: {
                    chain: chain
                },
                producerId: {
                    notIn: Array.from(returnedProducerIds)
                }
            }
        });

        logger_log('BUNDLES', `Updated bundle votes for ${chain}. Received ${response.data.rows.length} bundle votes.`);
    } catch (error) {
        logger_error('BUNDLES', `Catch all error in fetchBundleVotes() for ${chain}: `, error);
    }
}