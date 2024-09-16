import { prisma } from '../config/database';
import { config } from '../config/env';
import { formatUrl, urlJoin, processTotalVotes, getFullBaseUrl } from "../utils/helpers";
import { logger_log, logger_error } from '../utils/logger';
import axios from 'axios';

interface Socials {
    [key: string]: string;
}

interface Node {
    type: string;
    [key: string]: any;
}

interface NodesByType {
    producer: Node[];
    query: Node[];
    full: Node[];
    seed: Node[];
    other: Node[];
}

// Queries db for active producers' data
export const getProducersQuery = async (limit?: number, chain: 'mainnet' | 'testnet' = 'mainnet') => {
    let whereClause: any = {
        status: 'active',
        chain: chain === 'mainnet' ? 'Mainnet' : 'Testnet'
    };

    const producers = await prisma.producer.findMany({
        where: whereClause,
        include: {
            extendedData: true,
            socials: true,
            nodes: true,
            branding: true,
            scores: {
                orderBy: {
                    time_stamp: 'desc'
                },
                take: 1
            },
            bundleVotes: true,
            feeMultiplier: true,
            feeVotes: true,
            tools: true
        },
        orderBy: {
            total_votes: 'desc'
        },
        take: limit
    });

     return producers.map(producer => {
        const { extendedData, socials, nodes, branding, scores, bundleVotes, feeMultiplier, feeVotes, tools, ...producerData } = producer;
        const {
             candidate_name = null,
             website = null,
             code_of_conduct = null,
             email = null,
             ownership_disclosure = null,
             location_name = null,
             location_country = null,
             location_latitude = null,
             location_longitude = null
         } = extendedData || {};

        return {
            ...producerData,
            total_votes: Number(producerData.total_votes),
            candidate_name,
            website,
            code_of_conduct,
            email,
            ownership_disclosure,
            location_name,
            location_country,
            location_latitude,
            location_longitude,
            flagIconUrl: extendedData?.location_country
                ? `${getFullBaseUrl()}/flags/${extendedData.location_country.toLowerCase()}.svg`
                : null,
            socials: socials.length > 0 ? socials.reduce((acc, social) => {
                if (social.type && social.handle) {
                    acc[social.type] = social.handle;
                }
                return acc;
            }, {} as Socials) : {},
            nodes: nodes.length > 0 ? nodes.reduce((acc, node) => {
                const { id, producerId, ...nodeData } = node;
                const nodeType = node.type as keyof NodesByType;
                if (!acc[nodeType]) acc[nodeType] = [];
                acc[nodeType].push(nodeData);
                return acc;
            }, {} as NodesByType) : {},
            branding: branding.length > 0 ? branding.reduce((acc, brand) => {
                acc[brand.type] = brand.url;
                return acc;
            }, {} as { [key: string]: string }) : {},
            score: scores.length > 0 ? {
                time_stamp: scores[0].time_stamp,
                details: scores[0].details,
                score: scores[0].score,
                max_score: scores[0].max_score,
                grade: scores[0].grade
            } : null,
            bundleVotes: bundleVotes ? {
                bundledbvotenumber: bundleVotes.bundledbvotenumber,
                lastvotetimestamp: bundleVotes.lastvotetimestamp
            } : {},
            feeMultiplier: feeMultiplier ? {
                multiplier: feeMultiplier.multiplier,
                last_vote: feeMultiplier.last_vote
            } : {},
            feeVotes: feeVotes.length > 0 ? feeVotes.reduce((acc, vote) => {
                acc[vote.end_point] = {
                    value: vote.value.toString(),
                    last_vote: vote.last_vote
                };
                return acc;
            }, {} as { [key: string]: { value: string, last_vote: Date } }) : {},
            tools: tools.length > 0 ? tools.reduce((acc, tool) => {
                acc[tool.toolName] = tool.toolUrl;
                return acc;
            }, {} as { [key: string]: string }) : {}
        };
    });
};

// Fetches producers for Mainnet and Testnet
export async function fetchProducers() {
    try {
        const chains = ['Mainnet', 'Testnet'];
        const apiUrls = [config.mainnetApiUrl, config.testnetApiUrl];
        const existingProducerIdsByChain: { [chain: string]: Set<number> } = {
            Mainnet: new Set<number>(),
            Testnet: new Set<number>(),
        };

        for (let i = 0; i < chains.length; i++) {
            const chain = chains[i];
            const apiUrl = apiUrls[i];

            logger_log('PRODUCERS',`Fetching producers for ${chain} from ${apiUrl}`);
            const response = await axios.post(`${apiUrl}/v1/chain/get_producers`, { limit: 1000 });
            logger_log('PRODUCERS',`Received ${response.data.producers.length} producers for ${chain}. Updating db...`);

            // Update database
            for (const producer of response.data.producers) {
                const chain_table_id = producer.id;
                existingProducerIdsByChain[chain].add(chain_table_id);
                producer.url = formatUrl(producer.url);
                const { id, is_active, total_votes, ...producerData } = producer;
                const status = is_active === 1 ? 'active' : 'inactive';
                const processedVotes = processTotalVotes(producer.total_votes);
                const existingProducer = await prisma.producer.findUnique({
                    where: {
                        chain_chain_table_id: {
                            chain,
                            chain_table_id,
                        },
                    },
                });

                await prisma.producer.upsert({
                    where: {
                        chain_chain_table_id: {
                            chain,
                            chain_table_id,
                        },
                    },
                    update: {
                        ...producerData,
                        total_votes: processedVotes,
                        status,
                        last_claim_time: new Date(producer.last_claim_time),
                    },
                    create: {
                        ...producerData,
                        total_votes: processedVotes,
                        status,
                        last_claim_time: new Date(producer.last_claim_time),
                        chain,
                        chain_table_id,
                    },
                });

                // If the producer status changed to inactive, update their nodes
                if (existingProducer && existingProducer.status === 'active' && status === 'inactive') {
                    await prisma.producerNodes.updateMany({
                        where: { producerId: existingProducer.id },
                        data: { status: 'inactive' }
                    });
                }

                logger_log('PRODUCERS',`Upserted producer ${chain_table_id} for ${chain}.`);
            }
        }

        // Update status to 'removed' for producers not returned in the API responses
        for (const chain of chains) {
            logger_log('PRODUCERS',`Updating status to 'removed' for producers not returned for ${chain}.`);
            const producersToRemove = await prisma.producer.findMany({
                where: {
                    chain: chain,
                    chain_table_id: { notIn: Array.from(existingProducerIdsByChain[chain]) },
                    status: { not: 'removed' }
                }
            });

            for (const producer of producersToRemove) {
                await prisma.producer.update({
                    where: { id: producer.id },
                    data: { status: 'removed' }
                });

                // Set all nodes of this producer to 'removed'
                await prisma.producerNodes.updateMany({
                    where: { producerId: producer.id },
                    data: { status: 'removed' }
                });
            }
        }
    } catch (error) {
        logger_error('PRODUCERS','Catch all error in fetchProducers() ', error);
    }
    logger_log('PRODUCERS',`Done updating with producer list.`);
}

// Fetches chains.json for all active producers from db and determines bp.json to query
export async function fetchBpJson() {
    logger_log('PRODUCERS',`Starting fetching bp.json...`);
    try {
        const activeProducers = await prisma.producer.findMany({
            where: {status: 'active' }
        });

        for (const producer of activeProducers) {
            let url = producer.url;

            if (!url) {
                logger_log('PRODUCERS',`Skipping ${producer.chain} producer ${producer.id} with empty URL.`);
                continue;
            }

            url = formatUrl(url);
            let chainsJsonFound = false;

            try {
                logger_log('PRODUCERS',`Fetching chains.json for ${producer.chain} producer ${producer.id} from ${url}`);
                const chainsResponse = await axios.get(urlJoin(url, `chains.json`), { timeout: config.json_fetch_timeout });
                const chains = chainsResponse.data.chains;
                chainsJsonFound = true;

                if (chains) {
                    const chainId = producer.chain === 'Mainnet' ? config.mainnetChainId : config.testnetChainId;
                    if (chains[chainId]) {
                        await processBpJson(producer.id, urlJoin(url, chains[chainId]), producer.chain);
                    } else {
                        logger_log('PRODUCERS',`Chain ID not found in chains.json for ${producer.chain} producer ${producer.id}.`);
                    }
                } else {
                    logger_log('PRODUCERS',`Invalid chains.json for ${producer.chain} producer ${producer.id}.`);
                }
            } catch {
                logger_log('PRODUCERS',`Unable to fetch chains.json for ${producer.chain} producer ${producer.id}.`);
            }

            if (!chainsJsonFound) {
                logger_log('PRODUCERS',`${producer.chain} producer ${producer.id} has no chains.json. Trying bp.json at ${url}`);
                try {
                    await processBpJson(producer.id, urlJoin(url, `bp.json`), producer.chain);
                } catch {
                    logger_log('PRODUCERS',`Unable to fetch bp.json for ${producer.chain} producer ${producer.id}.`);
                }
            }
        }
    } catch (error) {
        logger_error('PRODUCERS','Catch all error in fetchBpJson() ', error);
    }
    logger_log('PRODUCERS',`Done with bp.json`);
}

// Fetches and processes individual bp.json
async function processBpJson(producerId: number, bpJsonUrl: string, chain: string) {
    try {
        logger_log('PRODUCERS', `Fetching bp.json for ${chain} producer ${producerId} from ${bpJsonUrl}`);
        const bpResponse = await axios.get(bpJsonUrl, { timeout: config.json_fetch_timeout });
        const bpData = bpResponse.data;

        if (bpData && typeof bpData === 'object' && bpData.org && typeof bpData.org === 'object') {
            logger_log('PRODUCERS', `Got bp.json for ${chain} producer ${producerId}. Updating db...`);

            // Check for required fields
            if (!bpData.org.candidate_name || !bpData.org.location) {
                logger_log('PRODUCERS', `Invalid bp.json structure for ${chain} producer ${producerId}. Missing required fields.`);
                return;
            }

            // Insert into ProducerExtendedData
            await prisma.producerExtendedData.upsert({
                where: { producerId },
                update: {
                    candidate_name: bpData.org.candidate_name,
                    website: formatUrl(bpData.org.website || ''),
                    code_of_conduct: formatUrl(bpData.org.code_of_conduct || ''),
                    email: bpData.org.email || '',
                    ownership_disclosure: formatUrl(bpData.org.ownership_disclosure || ''),
                    location_name: bpData.org.location.name || '',
                    location_country: bpData.org.location.country || '',
                    location_latitude: bpData.org.location.latitude || 0,
                    location_longitude: bpData.org.location.longitude || 0,
                },
                create: {
                    producerId,
                    candidate_name: bpData.org.candidate_name,
                    website: formatUrl(bpData.org.website || ''),
                    code_of_conduct: formatUrl(bpData.org.code_of_conduct || ''),
                    email: bpData.org.email || '',
                    ownership_disclosure: formatUrl(bpData.org.ownership_disclosure || ''),
                    location_name: bpData.org.location.name || '',
                    location_country: bpData.org.location.country || '',
                    location_latitude: bpData.org.location.latitude || 0,
                    location_longitude: bpData.org.location.longitude || 0,
                },
            });

            // Process socials
            const existingSocials = await prisma.producerSocials.findMany({ where: { producerId } });
            const existingSocialTypes = new Set(existingSocials.map(social => social.type));

            if (bpData.org.social && typeof bpData.org.social === 'object') {
                const socialKeys = Object.keys(bpData.org.social);
                for (const key of socialKeys) {
                    if (bpData.org.social[key]) {
                        await prisma.producerSocials.upsert({
                            where: {
                                producerId_type: {
                                    producerId,
                                    type: key,
                                },
                            },
                            update: {
                                handle: bpData.org.social[key],
                            },
                            create: {
                                producerId,
                                type: key,
                                handle: bpData.org.social[key],
                            },
                        });
                        existingSocialTypes.delete(key);
                    }
                }
            }

            // Remove socials not present in bp.json
            if (existingSocialTypes.size > 0) {
                await prisma.producerSocials.deleteMany({
                    where: {
                        producerId,
                        type: { in: Array.from(existingSocialTypes) },
                    },
                });
            }

            // Process nodes
            const existingNodes = await prisma.producerNodes.findMany({ where: { producerId } });
            const existingNodeUrls = new Set(existingNodes.map(node => node.url));
            const updatedNodeUrls = new Set();

            if (Array.isArray(bpData.nodes)) {
                for (const node of bpData.nodes) {
                    const api = node.features?.includes('chain-api') || node.features?.includes('fio-api') || node.node_type === 'query' || node.node_type === 'full';
                    const historyV1 = node.features?.includes('history-v1');
                    const hyperion = node.features?.includes('hyperion-v2');
                    let nodeTypes: string[] = Array.isArray(node.node_type) ? node.node_type : [node.node_type];
                    const url = node.ssl_endpoint || node.api_endpoint || node.p2p_endpoint;
                    let nodeUrl = url || '';
                    if (nodeTypes.includes('query') || nodeTypes.includes('full')) nodeUrl = formatUrl(nodeUrl);

                    for (const type of nodeTypes) {
                        if (type !== 'producer' && !nodeUrl) {
                            logger_log('PRODUCERS', `Skipping node of type ${type} with missing URL for producer ${producerId}.`);
                            continue;
                        }

                        updatedNodeUrls.add(nodeUrl);

                        const existingNode = await prisma.producerNodes.findFirst({
                            where: {
                                producerId,
                                type,
                                url: nodeUrl
                            }
                        });

                        if (existingNode) {
                            // Update existing node
                            logger_log('PRODUCERS', `Updating existing node ${existingNode.id} for producer ${producerId}.`);
                            await prisma.producerNodes.update({
                                where: { id: existingNode.id },
                                data: {
                                    location_name: node.location?.name || '',
                                    location_country: node.location?.country || '',
                                    location_latitude: node.location?.latitude || 0,
                                    location_longitude: node.location?.longitude || 0,
                                    chain,
                                    api: !!api,
                                    historyV1: !!historyV1,
                                    hyperion: !!hyperion,
                                    server_version: node.server_version || '',
                                    status: 'active'
                                }
                            });
                        } else {
                            // Create new node
                            logger_log('PRODUCERS', `Inserting new node for producer ${producerId}.`);
                            await prisma.producerNodes.create({
                                data: {
                                    producerId,
                                    location_name: node.location?.name || '',
                                    location_country: node.location?.country || '',
                                    location_latitude: node.location?.latitude || 0,
                                    location_longitude: node.location?.longitude || 0,
                                    type,
                                    chain,
                                    api: !!api,
                                    historyV1: !!historyV1,
                                    hyperion: !!hyperion,
                                    url: nodeUrl,
                                    server_version: node.server_version || '',
                                    status: 'active'
                                }
                            });
                        }
                    }
                }
            }

            // Set nodes not present in bp.json to removed
            const nodesToRemove = Array.from(existingNodeUrls).filter(url => !updatedNodeUrls.has(url));
            if (nodesToRemove.length > 0) {
                logger_log('PRODUCERS', `Setting ${nodesToRemove.length} nodes to removed for producer ${producerId}.`);
                await prisma.producerNodes.updateMany({
                    where: {
                        producerId,
                        url: { in: nodesToRemove }
                    },
                    data: { status: 'removed' }
                });
            }

            // Process branding
            const existingBranding = await prisma.producerBranding.findMany({ where: { producerId } });
            const existingBrandingTypes = new Set(existingBranding.map(branding => branding.type));

            if (bpData.org.branding && typeof bpData.org.branding === 'object') {
                const brandingTypes = ['logo_256', 'logo_1024', 'logo_svg'];
                for (const type of brandingTypes) {
                    if (bpData.org.branding[type]) {
                        try {
                            // Verify image before inserting
                            const imageResponse = await axios.get(bpData.org.branding[type], {
                                timeout: 5000,
                                responseType: 'arraybuffer'
                            });

                            if (imageResponse.status === 200) {
                                await prisma.producerBranding.upsert({
                                    where: {
                                        producerId_type: {
                                            producerId,
                                            type,
                                        },
                                    },
                                    update: {
                                        url: bpData.org.branding[type],
                                    },
                                    create: {
                                        producerId,
                                        type,
                                        url: bpData.org.branding[type],
                                    },
                                });
                                existingBrandingTypes.delete(type);
                                logger_log('PRODUCERS', `Successfully processed branding asset for ${chain} producer ${producerId}, type ${type}`);
                            } else {
                                logger_log('PRODUCERS', `Failed to verify branding asset for ${chain} producer ${producerId}, type ${type}: ${imageResponse.status}`);
                            }
                        } catch (error) {
                            if (axios.isAxiosError(error)) {
                                if (error.response) {
                                    logger_log('PRODUCERS', `Failed to fetch branding asset for ${chain} producer ${producerId}, type ${type}. Status: ${error.response.status}`);
                                } else if (error.request) {
                                    logger_log('PRODUCERS', `Failed to fetch branding asset for ${chain} producer ${producerId}, type ${type}. No response received.`);
                                } else {
                                    logger_log('PRODUCERS', `Failed to fetch branding asset for ${chain} producer ${producerId}, type ${type}. Error: ${error.message}`);
                                }
                            } else {
                                logger_error('PRODUCERS', `Unexpected error verifying branding asset for ${chain} producer ${producerId}, type ${type}`, error);
                            }
                        }
                    }
                }
            }

            // Remove branding not present in bp.json
            if (existingBrandingTypes.size > 0) {
                await prisma.producerBranding.deleteMany({
                    where: {
                        producerId,
                        type: { in: Array.from(existingBrandingTypes) },
                    },
                });
                logger_log('PRODUCERS', `Removed ${existingBrandingTypes.size} outdated branding entries for ${chain} producer ${producerId}`);
            }
        } else {
            logger_log('PRODUCERS', `Invalid or empty bp.json received for ${chain} producer ${producerId} from url: ${bpJsonUrl}`);
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.response) {
                logger_log('PRODUCERS', `Failed to fetch bp.json for ${chain} producer ${producerId} from url: ${bpJsonUrl}. Status: ${error.response.status}`);
            } else if (error.request) {
                logger_log('PRODUCERS', `Failed to fetch bp.json for ${chain} producer ${producerId} from url: ${bpJsonUrl}. No response received.`);
            } else {
                logger_log('PRODUCERS', `Failed to fetch bp.json for ${chain} producer ${producerId} from url: ${bpJsonUrl}. Error: ${error.message}`);
            }
        } else {
            logger_log('PRODUCERS', `Error processing bp.json for ${chain} producer ${producerId} from url: ${bpJsonUrl}. Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
