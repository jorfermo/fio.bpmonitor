import { prisma } from '../config/database';
import { config } from '../config/env';
import { logger_log, logger_error } from '../utils/logger';
import axios from 'axios';

// Queries db for active node data
export const getNodesQuery = async (chain: 'mainnet' | 'testnet' = 'mainnet', type: 'api' | 'seed' | 'producer' = 'api') => {
    let whereClause: any = {
        status: 'active',
        chain: chain === 'mainnet' ? 'Mainnet' : 'Testnet'
    };

    switch (type) {
        case 'api':
            whereClause.type = { in: ['full', 'query'] };
            break;
        case 'seed':
            whereClause.type = 'seed';
            break;
        case 'producer':
            whereClause.type = 'producer';
            break;
    }

    const nodes = await prisma.producerNodes.findMany({
        where: whereClause,
    });

    return nodes;
};

// Checks nodes in producerNodes
export const checkNode = async () => {
    const nodes = await prisma.producerNodes.findMany({
        where: {
            type: {
                in: ['query', 'full'],
            },
            status: { in: ['active', 'down', 'reported'] },
        },
    });

    for (const node of nodes) {
        logger_log('NODES',`Node: ${node.id}: Starting checks for ${node.url}`);
        try {
            const response = await axios.get(`${node.url}/v1/chain/get_info`, { timeout: config.node_check_timeout });
            if (response.status === 200) {
                const data = response.data;
                const serverVersion = data.server_version_string;
                const chainId = data.chain_id;

                if (serverVersion) {
                    logger_log('NODES',`Node: ${node.id}: API node is running ${serverVersion}`);

                    // Update server_version in ProducerNode
                    await prisma.producerNodes.update({
                        where: { id: node.id },
                        data: {
                            server_version: serverVersion,
                            status: 'active'
                        },
                    });

                    // Check chain_id and update ProducerNode status if it doesn't match the expected chain IDs and node.chain
                    if ((chainId === config.mainnetChainId && node.chain !== 'Mainnet') ||
                        (chainId === config.testnetChainId && node.chain !== 'Testnet') ||
                        (chainId !== config.mainnetChainId && chainId !== config.testnetChainId)) {
                        logger_log('NODES',`Node: ${node.id}: Mainnet/Testnet mismatch. Updating status...`)
                        await prisma.producerNodes.update({
                            where: { id: node.id },
                            data: { status: 'inactive' },
                        });
                        // Insert into APINodeChecks
                        await prisma.apiNodeCheck.create({
                            data: {
                                nodeId: node.id,
                                status: 10000,
                            },
                        });
                        continue;
                    }

                    // Insert into APINodeChecks
                    await prisma.apiNodeCheck.create({
                        data: {
                            nodeId: node.id,
                            server_version: serverVersion,
                            head_block_time: new Date(data.head_block_time),
                            status: response.status,
                        },
                    });

                    // Perform fetch check
                    await checkNodeFetch(node.id, node.url);
                } else {
                    logger_log('NODES',`Node: ${node.id}: API node response received, but server version not found.`);
                    await prisma.apiNodeCheck.create({
                        data: {
                            nodeId: node.id,
                            server_version: '',
                            status: 0,
                        },
                    });
                    await updateNodeStatus(node.id);
                }
            } else {
                // Handle non-200 response
                logger_log('NODES',`Node: ${node.id}: API node is not running`);
                await prisma.apiNodeCheck.create({
                    data: {
                        nodeId: node.id,
                        server_version: '',
                        status: response.status,
                    },
                });
                await updateNodeStatus(node.id);
            }

        } catch (error: any) {
            if (error.response) {
                // Server responded with a status other than 2xx
                logger_log('NODES',`Node: ${node.id}: API node is not running.`);
                await prisma.apiNodeCheck.create({
                    data: {
                        nodeId: node.id,
                        server_version: '',
                        status: error.response.status,
                    },
                });
            } else {
                // Unable to connect (timeout, DNS issues, etc.)
                logger_log('NODES',`Node: ${node.id}: API node is not running.`);
                await prisma.apiNodeCheck.create({
                    data: {
                        nodeId: node.id,
                        server_version: '',
                        status: 0,
                    },
                });
            }
            await updateNodeStatus(node.id);
        }

        // Check V1 History
        try {
            const historyResponse = await axios.post(`${node.url}/v1/history/get_actions`, {
                account_name: 'tw4tjkmo4eyd'
            }, { timeout: config.node_check_timeout });

            if (historyResponse.status === 200 && historyResponse.data.last_irreversible_block) {
                logger_log('NODES',`Node: ${node.id}: V1 History is running.`)
                await prisma.producerNodes.update({
                    where: { id: node.id },
                    data: { historyV1: true },
                });
            } else {
                logger_log('NODES',`Node: ${node.id}: V1 History is not running.`)
                await prisma.producerNodes.update({
                    where: { id: node.id },
                    data: { historyV1: false },
                });
            }
        } catch (historyError: any) {
            logger_log('NODES',`Node: ${node.id}: V1 History is not running.`)
            await prisma.producerNodes.update({
                where: { id: node.id },
                data: { historyV1: false },
            });
        }

        // Check Hyperion
        try {
            const healthResponse = await axios.get(`${node.url}/v2/health`, { timeout: config.node_check_timeout });

            if (healthResponse.status === 200) {
                const healthData = healthResponse.data;
                const nodeosRPC = healthData.health.find((service: { service: string }) => service.service === 'NodeosRPC');

                if (nodeosRPC && nodeosRPC.status === 'OK' && Math.abs(nodeosRPC.service_data?.time_offset || Infinity) <= 1800000) {
                    logger_log('NODES',`Node: ${node.id}: Hyperion is running.`)
                    await prisma.producerNodes.update({
                        where: { id: node.id },
                        data: { hyperion: true },
                    });
                } else {
                    logger_log('NODES',`Node: ${node.id}: Hyperion is not running.`)
                    await prisma.producerNodes.update({
                        where: { id: node.id },
                        data: { hyperion: false },
                    });
                }
            } else {
                logger_log('NODES',`Node: ${node.id}: Hyperion is not running.`)
                await prisma.producerNodes.update({
                    where: { id: node.id },
                    data: { hyperion: false },
                });
            }
        } catch (healthError: any) {
            logger_log('NODES',`Node: ${node.id}: Hyperion is not running.`)
            await prisma.producerNodes.update({
                where: { id: node.id },
                data: { hyperion: false },
            });
        }
    }
    logger_log('NODES',`Node checks complete.`)
};

// Updates node status in producerNodes
async function updateNodeStatus(nodeId: number) {
    const recentChecks = await prisma.apiNodeCheck.findMany({
        where: { nodeId },
        orderBy: { time_stamp: 'desc' },
        take: 3
    });

    if (recentChecks.length === 3 && recentChecks.every(check => !check.server_version)) {
        await prisma.producerNodes.update({
            where: { id: nodeId },
            data: { status: 'down' }
        });
    }
}

// Checks node for number of results returned
async function checkNodeFetch(nodeId: number, url: string) {
    try {
        const response = await axios.post(`${url}/v1/chain/get_table_rows`, {
            json: true,
            code: "fio.address",
            scope: "fio.address",
            table: "fionames"
        });

        if (response.status === 200 && response.data && Array.isArray(response.data.rows)) {
            const resultsCount = response.data.rows.length;
            await prisma.apiFetchCheck.create({
                data: {
                    nodeId,
                    results: resultsCount
                }
            });
            logger_log('NODES', `Node: ${nodeId}: Fetch check successful. Results: ${resultsCount}`);
        } else {
            await prisma.apiFetchCheck.create({
                data: {
                    nodeId,
                    results: 0
                }
            });
            logger_log('NODES', `Node: ${nodeId}: Fetch check failed. Malformed response.`);
        }
    } catch (error: unknown) {
        await prisma.apiFetchCheck.create({
            data: {
                nodeId,
                results: 0
            }
        });
        if (error instanceof Error) {
            logger_log('NODES', `Node: ${nodeId}: Fetch check failed. Error: ${error.message}`);
        } else {
            logger_log('NODES', `Node: ${nodeId}: Fetch check failed. Unknown error occurred.`);
        }
    }
}