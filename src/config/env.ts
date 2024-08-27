import * as dotenv from 'dotenv';

dotenv.config();

export const config = {
    baseUrl: process.env.BASE_URL || 'http://localhost',
    dbUrl: process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/bpmonitor",
    port: process.env.PORT || 4000,
    external_port: process.env.EXTERNAL_PORT || 4000,
    logging: process.env.LOGGING || 'file',// console or file
    loggingLevel: process.env.LOGGING_LEVEL || 'error',
    json_fetch_timeout: Number(process.env.JSON_FETCH_TIMEOUT) || 5000,
    node_check_timeout: Number(process.env.NODE_CHECK_TIMEOUT) || 10000,
    mainnetApiUrl: process.env.MAINNET_API_URL || "https://api.fiosweden.org",// Must run Hyperion
    testnetApiUrl: process.env.TESTNET_API_URL || "https://api.testnet.fiosweden.org",// Must run Hyperion
    mainnetChainId: process.env.MAINNET_CHAIN_ID || "21dcae42c0182200e93f954a074011f9048a7624c6fe81d3c9541a614a88bd1c",
    testnetChainId: process.env.TESTNET_CHAIN_ID || "b20901380af44ef59c5918439a1f9a41d83669020319a80574b804a5f95cbd7e",
    mainnetProposer: process.env.MAINNET_PROPOSER || "fio1uipge5sr",
    testnetProposer: process.env.TESTNET_PROPOSER || "nyvrxkxhiyql",
    producerToolsUrl: process.env.PRODUCER_TOOLS_URL || 'https://raw.githubusercontent.com/fioprotocol/fio.bpmonitor/master/bptools.md',
    scoringCriteria: JSON.parse(process.env.SCORING_CRITERIA || '{"has_bp_json":10,"reports_producer_node":10,"reports_seed_node":10,"reports_query_node":10,"runs_api_node":20,"reports_latest_version":20,"runs_history_node":20,"runs_hyperion_node":20,"results_a":10,"results_b":10,"results_c":10,"fee_votes":20,"fee_voted_recently":20,"bundle_votes":20,"runs_tools":30,"signs_msigs":30,"signs_msigs_quickly":30}'),
    gradeChart: JSON.parse(process.env.GRADE_CHART || '{"A+": [96, 100], "A": [91, 95], "A-": [86, 90], "B+": [81, 85], "B": [76, 80], "B-": [71, 75], "C+": [66, 70], "C": [61, 65], "C-": [56, 60], "D+": [51, 55], "D": [46, 50], "D-": [41, 45], "F": [0, 40]}'),
    resultPercentiles: JSON.parse(process.env.RESULT_PERCENTILES || '{"results_a":75,"results_b":50,"results_c":25}'),
    evaluate_msigs_count: parseInt(process.env.EVALUATE_MSIGS_COUNT || '25', 10),
    evaluate_msigs_percent: parseInt(process.env.EVALUATE_MSIGS_PERCENT || '75', 10),
    evaluate_msigs_time: parseInt(process.env.EVALUATE_MSIGS_PERCENT || '7', 10),
};
