import fs from 'fs';
import path from 'path';
import { config } from '../config/env';

// todo add logging level
const logDirectory = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory);
}

const getTimestamp = (): string => {
    return new Date().toISOString();
};

const writeLog = (level: string, section: string, message: string) => {
    const timestamp = getTimestamp();
    const logMessage = `${timestamp} [${section}] ${level}: ${message}\n`;
    const logFilePath = path.join(logDirectory, `${section.toLowerCase()}.log`);

    if (config.logging === 'console' || config.logging === 'file') {
        if (config.logging === 'console') {
            process.stdout.write(logMessage);
        } else if (config.logging === 'file') {
            fs.appendFileSync(logFilePath, logMessage);
        }
    }
};

export const logger_log = (section: string, message: string) => {
    writeLog('INFO', section, message);
};

export const logger_error = (section: string, message: string, error: any) => {
    const errorMessage = error?.message || 'Unknown error occurred';
    writeLog('ERROR', section, `${message}: ${errorMessage}`);
};
