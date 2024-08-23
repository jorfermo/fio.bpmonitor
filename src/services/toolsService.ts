import { prisma } from '../config/database';
import { config } from '../config/env';
import { logger_log, logger_error } from '../utils/logger';
import axios from 'axios';

interface ProducerTool {
    Chain: string;
    Producer: string;
    'Tool name': string;
    'Tool Url': string;
}

// Triggers producer tool fetch from Github
export async function triggerToolsFetch() {
    try {
        logger_log('PRODUCER_TOOLS', 'Fetching producer tools from GitHub');
        const response = await axios.get(config.producerToolsUrl);
        const toolsData = parseToolsData(response.data);

        await updateProducerTools(toolsData);
        logger_log('PRODUCER_TOOLS', `Updated producer tools. Processed ${toolsData.length} tools.`);
    } catch (error) {
        logger_error('PRODUCER_TOOLS', 'Catch all error in fetchAndUpdateProducerTools(): ', error);
    }
}

// Parses producer tools data fetched from Github
function parseToolsData(rawData: string): ProducerTool[] {
    try {
        const lines = rawData.split('\n');
        const tools: ProducerTool[] = [];

        for (let i = 2; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line && line.startsWith('|') && line.endsWith('|')) {
                const [Chain, Producer, ToolName, ToolUrl] = line.slice(1, -1).split('|').map(item => item.trim());
                if (Chain && Producer && ToolName && ToolUrl) {
                    tools.push({ Chain, Producer, 'Tool name': ToolName, 'Tool Url': ToolUrl });
                }
            }
        }

        logger_log('PRODUCER_TOOLS', `Parsed ${tools.length} tools from the data`);
        return tools;
    } catch (error) {
        logger_error('PRODUCER_TOOLS', 'Error parsing tools data: ', error);
        return [];
    }
}

// Updates producer tools data in db
async function updateProducerTools(tools: ProducerTool[]) {
    try {
        // Truncate the producerTools table
        await prisma.producerTools.deleteMany({});
        // Reset the auto-increment counter to 1
        await prisma.$executeRaw`ALTER SEQUENCE "producerTools_id_seq" RESTART WITH 1`;
        logger_log('PRODUCER_TOOLS', 'Truncated producerTools table');

        const updatedProducers = new Set<number>();
        const notFoundProducers = new Set<string>();

        // Bulk insert all tools
        for (const tool of tools) {
            const chain = tool.Chain === 'Mainnet' ? 'Mainnet' : 'Testnet';
            const producer = await prisma.producer.findFirst({
                where: { owner: tool.Producer, chain }
            });

            if (producer) {
                await prisma.producerTools.create({
                    data: {
                        producerId: producer.id,
                        toolName: tool['Tool name'],
                        toolUrl: tool['Tool Url']
                    }
                });
                updatedProducers.add(producer.id);
            } else {
                notFoundProducers.add(`${tool.Producer} (${chain})`);
            }
        }

        logger_log('PRODUCER_TOOLS', `Reloaded tools for ${updatedProducers.size} producers.`);
        if (notFoundProducers.size > 0) {
            logger_log('PRODUCER_TOOLS', `Producers not found in the database: ${Array.from(notFoundProducers).join(', ')}`);
        }
    } catch (error) {
        logger_error('PRODUCER_TOOLS', 'Error updating producer tools: ', error);
    }
}