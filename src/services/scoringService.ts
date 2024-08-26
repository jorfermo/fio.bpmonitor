import {prisma} from '../config/database';
import {config} from '../config/env';
import {logger_error, logger_log} from '../utils/logger';

interface ScoringCriteria {
    [key: string]: number;
}

interface GradeChart {
    [key: string]: [number, number];
}

// Queries db for producer scores
export async function getScoresQuery(limit?: number, chain: 'mainnet' | 'testnet' = 'mainnet') {
    try {
        const whereClause = {
            producer: {
                chain: chain === 'mainnet' ? 'Mainnet' : 'Testnet'
            }
        };

        return await prisma.producerScores.findMany({
            where: whereClause,
            orderBy: {
                time_stamp: 'desc'
            },
            take: limit
        });
    } catch (error) {
        logger_error('SCORING', 'Error fetching producer scores:', error);
        throw error;
    }
}

// Calculates score for each producer
export async function calculateProducerScores() {
    try {
        const producers = await prisma.producer.findMany({
            where: { status: 'active' },
            include: {
                extendedData: true,
                nodes: true,
                feeMultiplier: true,
                feeVotes: true,
                bundleVotes: true,
                tools: true,
            },
        });

        const scoringCriteria: ScoringCriteria = config.scoringCriteria;
        const resultPercentiles = config.resultPercentiles;

        // Group producers by chain
        const producersByChain: { [key: string]: typeof producers } = {};
        producers.forEach(producer => {
            if (!producersByChain[producer.chain]) {
                producersByChain[producer.chain] = [];
            }
            producersByChain[producer.chain].push(producer);
        });

        for (const [, chainProducers] of Object.entries(producersByChain)) {
            for (const producer of chainProducers) {
                try {
                    const score = await calculateProducerScore(producer, scoringCriteria, resultPercentiles);
                    await saveScore(producer.id, score);
                } catch (error) {
                    logger_error('SCORING', `Error calculating score for producer ${producer.id}:`, error);
                }
            }
        }

        logger_log('SCORING', 'Producer scores calculated and saved successfully');
    } catch (error) {
        logger_error('SCORING', 'Catch all error in calculateProducerScores() ', error);
    }
}

// Calculates score for a single producer
async function calculateProducerScore(producer: any, scoringCriteria: ScoringCriteria, resultPercentiles: any) {
    const details: { [key: string]: { status: boolean; score: number } } = {
        has_bp_json: {
            status: !!producer.extendedData,
            score: 0
        },
        reports_producer_node: {
            status: producer.nodes?.some((node: any) => node.type === 'producer') ?? false,
            score: 0
        },
        reports_seed_node: {
            status: producer.nodes?.some((node: any) => node.type === 'seed') ?? false,
            score: 0
        },
        reports_query_node: {
            status: producer.nodes?.some((node: any) => ['query', 'full'].includes(node.type)) ?? false,
            score: 0
        },
        runs_api_node: {
            status: producer.nodes?.some((node: any) => node.api && node.status === 'active') ?? false,
            score: 0
        },
        reports_latest_version: {
            status: checkLatestVersion(producer.nodes || []),
            score: 0
        },
        runs_history_node: {
            status: producer.nodes?.some((node: any) => node.historyV1) ?? false,
            score: 0
        },
        runs_hyperion_node: {
            status: producer.nodes?.some((node: any) => node.hyperion) ?? false,
            score: 0
        },
        results_a: {
            status: await checkResultsPercentile(producer.id, resultPercentiles.results_a).catch(() => false),
            score: 0
        },
        results_b: {
            status: await checkResultsPercentile(producer.id, resultPercentiles.results_b).catch(() => false),
            score: 0
        },
        results_c: {
            status: await checkResultsPercentile(producer.id, resultPercentiles.results_c).catch(() => false),
            score: 0
        },
        fee_votes: {
            status: !!(producer.feeMultiplier && producer.feeVotes && producer.feeVotes.length > 0),
            score: 0
        },
        fee_voted_recently: {
            status: checkRecentFeeVote(producer),
            score: 0
        },
        bundle_votes: {
            status: !!producer.bundleVotes,
            score: 0
        },
        signs_msigs: {
            status: false,
            score: 0
        },
        signs_msigs_quickly: {
            status: false,
            score: 0
        },
        runs_tools: {
            status: !!(producer.tools && producer.tools.length > 0),
            score: 0
        },
    };

    let totalScore = 0;
    let maxScore = 0;

    // Calculate score for all criteria
    for (const [key, value] of Object.entries(scoringCriteria)) {
        maxScore += value;
        if (details[key] && details[key].status) {
            details[key].score = value;
            totalScore += value;
        }
    }

    const msigResults = await checkSignsMsigs(producer).catch((error) => {
        logger_error('SCORING', `Error checking MSIGs for producer ${producer.owner}:`, error);
        return { signedMsigs: false, signedMsigsQuickly: false };
    });

    if (msigResults.signedMsigs) {
        details['signs_msigs'].status = true;
        details['signs_msigs'].score = scoringCriteria['signs_msigs'];
        totalScore += scoringCriteria['signs_msigs'];
    }

    if (msigResults.signedMsigsQuickly) {
        details['signs_msigs_quickly'].status = true;
        details['signs_msigs_quickly'].score = scoringCriteria['signs_msigs_quickly'];
        totalScore += scoringCriteria['signs_msigs_quickly'];
    }

    const grade = calculateGrade(totalScore, maxScore);

    return { details, score: totalScore, max_score: maxScore, grade };
}

// Calculates grade
function calculateGrade(score: number, maxScore: number): string {
    if (maxScore === 0) return 'F';

    const percentage = Math.round((score / maxScore) * 100);  // Round to nearest integer
    const gradeChart: GradeChart = config.gradeChart;

    // Sort grade ranges from highest to lowest
    const sortedGrades = Object.entries(gradeChart).sort((a, b) => b[1][0] - a[1][0]);

    for (const [grade, [min, max]] of sortedGrades) {
        if (percentage >= min && percentage <= max) {
            return grade;
        }
    }

    return 'F';  // Default grade if no range matches
}

// Check for latest version of API node
function checkLatestVersion(nodes: any[]) {
    const versions = nodes
        .map(node => {
            const match = node.server_version.match(/v?(\d+\.\d+\.\d+)/);
            return match ? match[1] : null;
        })
        .filter(version => version !== null);

    if (versions.length === 0) {
        logger_log('SCORING', 'No valid versions found');
        return false;
    }

    const latestVersion = versions.reduce((a, b) => {
        return compareVersions(a, b) > 0 ? a : b;
    });

    return nodes.some(node => node.server_version.includes(latestVersion));
}

// Determines the latest version of API node
function compareVersions(a: string, b: string) {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
        if (partsA[i] > partsB[i]) return 1;
        if (partsA[i] < partsB[i]) return -1;
    }

    return 0;
}

// Determines if results returned by node fall within prescribed percentile
async function checkResultsPercentile(producerId: number, percentile: number) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const allResults = await prisma.apiFetchCheck.groupBy({
        by: ['nodeId'],
        _max: { results: true },
        where: {
            time_stamp: { gte: thirtyDaysAgo }
        }
    });

    if (allResults.length === 0) {
        logger_log('SCORING', `No results found for percentile calculation in the last 30 days`);
        return false;
    }

    const sortedResults = allResults.map(r => r._max.results).filter(r => r !== null).sort((a: any, b: any) => a - b);

    if (sortedResults.length === 0) {
        logger_log('SCORING', `No valid results found for percentile calculation in the last 30 days`);
        return false;
    }

    const percentileIndex = Math.floor(sortedResults.length * (percentile / 100));
    const percentileValue = sortedResults[percentileIndex];

    const producerMaxResults = await prisma.apiFetchCheck.aggregate({
        where: {
            producerNode: { producerId },
            time_stamp: { gte: thirtyDaysAgo }
        },
        _max: { results: true },
    });

    return (producerMaxResults._max.results || 0) >= (percentileValue || 0);
}

// Determines if producer has recent votes on fees
function checkRecentFeeVote(producer: any) {
    if (!producer.feeMultiplier || producer.feeVotes.length === 0) return false;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentMultiplierVote = producer.feeMultiplier.last_vote > thirtyDaysAgo;
    const recentFeeVote = producer.feeVotes.some((vote: any) => vote.last_vote > thirtyDaysAgo);

    return recentMultiplierVote || recentFeeVote;
}

// Determines if producer signed msigs and if they signed quickly
async function checkSignsMsigs(producer: any) {
    const evaluateMsigsCount = config.evaluate_msigs_count;
    const evaluateMsigsPercent = config.evaluate_msigs_percent;
    const evaluateMsigsTime = config.evaluate_msigs_time;

    logger_log('SCORING', `Checking MSIGs for producer ${producer.owner}`);

    const recentProposals = await prisma.proposals.findMany({
        where: { chain: producer.chain },
        orderBy: { time_stamp: 'desc' },
        take: evaluateMsigsCount,
    });

    let totalProposals = recentProposals.length;
    let signedCount = 0;
    let signedQuicklyCount = 0;

    for (const proposal of recentProposals) {
        let receivedActors: any[] = [];

        try {
            if (typeof proposal.received === 'string') {
                receivedActors = JSON.parse(proposal.received);
            } else if (Array.isArray(proposal.received)) {
                receivedActors = proposal.received;
            }
        } catch (error) {
            logger_error('SCORING', `Error parsing proposal`, error);
            continue;  // Skip
        }

        const producerSignature = receivedActors.find(item => item && typeof item === 'object' && item.actor === producer.owner);

        if (producerSignature) {
            signedCount++;

            if (producerSignature.time) {
                const proposalTime = new Date(proposal.time_stamp);
                const signTime = new Date(producerSignature.time);
                const daysDifference = (signTime.getTime() - proposalTime.getTime()) / (1000 * 3600 * 24);

                if (daysDifference <= evaluateMsigsTime) {
                    signedQuicklyCount++;
                }
            }
        }
    }

    const signedPercentage = (signedCount / totalProposals) * 100;
    const signedQuicklyPercentage = (signedQuicklyCount / totalProposals) * 100;

    logger_log('SCORING', `Producer ${producer.owner}: Signed ${signedCount}/${totalProposals} (${signedPercentage.toFixed(2)}%), Signed Quickly ${signedQuicklyCount}/${totalProposals} (${signedQuicklyPercentage.toFixed(2)}%)`);

    return {
        signedMsigs: signedPercentage >= evaluateMsigsPercent,
        signedMsigsQuickly: signedQuicklyPercentage >= evaluateMsigsPercent
    };
}

// Saves producer score and grade
async function saveScore(producerId: number, scoreData: any) {
    try {
        await prisma.producerScores.create({
            data: {
                producerId,
                details: scoreData.details,
                score: scoreData.score,
                max_score: scoreData.max_score,
                grade: scoreData.grade,
            },
        });
        logger_log('SCORING', `Score saved successfully for producer ${producerId}`);
    } catch (error) {
        logger_error('SCORING', `Catch all error in saveScore() for producer ${producerId}:`, error);
    }
}