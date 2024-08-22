import cron from 'node-cron';
import { fetchProducers, fetchBpJson  } from '../services/producerService';
import { checkNode } from '../services/nodeService';
import { triggerFeeMultiplierFetch } from '../services/feeService';
import { triggerBundleFetch } from '../services/bundleService';
import { fetchProposals } from '../services/proposalService';
import { calculateProducerScores } from '../services/scoringService';
import { logger_log, logger_error } from './logger';

cron.schedule('38 * * * *', async () => {
    try {
        await fetchProducers();
        logger_log('CRON','fetchAndUpdateProducers ran successfully.');
        await fetchBpJson();
        logger_log('CRON','fetchBPJson ran successfully.');
    } catch (error) {
        if (error instanceof Error) {
            logger_error('CRON',`fetchAndUpdateProducers and/or fetchBPJson job failed.`, error);
        } else {
            logger_log('CRON','fetchAndUpdateProducers and/or fetchBPJson job failed with an unknown .');
        }
    }
});

// +3 min
cron.schedule('41 * * * *', async () => {
    try {
        await checkNode();
        logger_log('CRON','checkNode ran successfully.');
    } catch (error) {
        if (error instanceof Error) {
            logger_error('CRON',`checkNode job failed.`, error);
        } else {
            logger_log('CRON','checkNode job failed with an unknown error.');
        }
    }
});

// +3
cron.schedule('44 * * * *', async () => {
    try {
        await triggerFeeMultiplierFetch();
        logger_log('CRON', 'fetchAndUpdateFees ran successfully.');
        await triggerBundleFetch();
        logger_log('CRON', 'fetchAndUpdateBundles ran successfully.');
    } catch (error) {
        if (error instanceof Error) {
            logger_error('CRON',`checkNode job failed.`, error);
        } else {
            logger_log('CRON','checkNode job failed with an unknown error.');
        }
    }
});

// +1
cron.schedule('45 * * * *', async () => {
    try {
        await fetchProposals();
        logger_log('CRON', 'fetchProposals ran successfully.');
    } catch (error) {
        if (error instanceof Error) {
            logger_error('CRON', `fetchProposals job failed.`, error);
        } else {
            logger_log('CRON', 'fetchProposals job failed with an unknown error.');
        }
    }
});

// +1
cron.schedule('46 * * * *', async () => {
    try {
        await calculateProducerScores();
        logger_log('CRON', 'calculateProducerScores ran successfully.');
    } catch (error) {
        if (error instanceof Error) {
            logger_error('CRON', `calculateProducerScores job failed.`, error);
        } else {
            logger_log('CRON', 'calculateProducerScores job failed with an unknown error.');
        }
    }
});