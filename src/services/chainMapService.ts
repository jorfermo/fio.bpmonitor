import { prisma } from '../config/database';
import { config } from '../config/env';
import { logger_log, logger_error } from '../utils/logger';
import axios from 'axios';

interface ProducerChainMap {
    mainnetProducer: string;
    testnetProducer: string;
}

// Triggers producer chain map fetch from Github
export async function triggerProducerChainMap() {
    try {
        logger_log('CHAIN_MAP', 'Fetching producer chain map from GitHub');
        const response = await axios.get(config.producerChainMapUrl);
        const chainMapData = parseChainMapData(response.data);

        await updateProducerChainMap(chainMapData);
        logger_log('CHAIN_MAP', `Updated producer chain map. Processed ${chainMapData.length} mappings.`);
    } catch (error) {
        logger_error('CHAIN_MAP', 'Error in fetchAndUpdateProducerChainMap(): ', error);
    }
}

// Parses producer chain map data fetched from Github
function parseChainMapData(rawData: string): ProducerChainMap[] {
    try {
        const lines = rawData.split('\n');
        const chainMap: ProducerChainMap[] = [];

        for (let i = 2; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line && line.startsWith('|') && line.endsWith('|')) {
                const [mainnetProducer, testnetProducer] = line.slice(1, -1).split('|').map(item => item.trim());
                if (mainnetProducer && testnetProducer) {
                    chainMap.push({ mainnetProducer, testnetProducer });
                }
            }
        }

        logger_log('CHAIN_MAP', `Parsed ${chainMap.length} mappings from the data`);
        return chainMap;
    } catch (error) {
        logger_error('CHAIN_MAP', 'Error parsing chain map data: ', error);
        return [];
    }
}

// Updates producer chain map data in db
async function updateProducerChainMap(chainMap: ProducerChainMap[]) {
    try {
        await prisma.producerChainMap.deleteMany({});
        await prisma.$executeRaw`ALTER SEQUENCE "ProducerChainMap_id_seq" RESTART WITH 1`;
        logger_log('CHAIN_MAP', 'Truncated ProducerChainMap table');

        await prisma.producerChainMap.createMany({
            data: chainMap
        });

        logger_log('CHAIN_MAP', `Reloaded ${chainMap.length} producer chain mappings.`);
    } catch (error) {
        logger_error('CHAIN_MAP', 'Error updating producer chain map: ', error);
    }
}