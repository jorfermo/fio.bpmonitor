// Helper functions
import { JsonValue } from '@prisma/client/runtime/library';
import { config } from '../config/env';

// Function to get the full base URL
export const getFullBaseUrl = () => {
    let baseUrl = config.baseUrl || 'http://localhost';
    const url = new URL(baseUrl);

    if (config.external_port !== null &&
        ((url.protocol === 'http:' && config.external_port !== 80) ||
            (url.protocol === 'https:' && config.external_port !== 443))) {
        url.port = config.external_port.toString();
    }

    return url.toString().replace(/\/$/, '');
};

// Format url
export function formatUrl(url: string): string {
    url = url.replace(/\/$/, '');
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
        return `https://${url}`;
    }
    return url;
}

// Join url with path from chain.json or bp.json
export function urlJoin(...parts: string[]): string {
    return parts
        .map(part => part.trim().replace(/^\/|\/$/g, ''))
        .filter(part => part.length)
        .join('/');
}

// Convert total_votes to Int
export function processTotalVotes(votesString: string): number {
    // Remove decimal places and divide by 1,000,000,000
    const votesWithoutDecimal = votesString.split('.')[0];
    const votesNumber = parseInt(votesWithoutDecimal, 10);
    return Math.floor(votesNumber / 1000000000);
}

// Safe handle json
export function parseJsonValue(value: JsonValue): Array<{ actor: string, time?: string }> {
    if (typeof value === 'object' && value !== null) {
        return Object.keys(value).map(key => {
            try {
                return JSON.parse(key);
            } catch {
                return { actor: '' };
            }
        }).filter(item => item && typeof item.actor === 'string');
    }
    return [];
}