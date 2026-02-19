export type LogSeverity = 'info' | 'warn' | 'error' | 'metric';

export interface LogEntry {
    level: LogSeverity;
    message: string;
    timestamp: number;
    data?: any;
}

export const log = async (level: LogSeverity, message: string, data?: any) => {
    const entry: LogEntry = {
        level,
        message,
        timestamp: Date.now(),
        data
    };

    if (process.env.NODE_ENV === 'development') {
        console.log(`[${level.toUpperCase()}] ${message}`, data || '');
    }

    try {
        await fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry),
        });
    } catch (e) {
        // Silent fail on logging
    }
};

export const trackMetric = (name: string, value: number, tags?: any) => {
    log('metric', name, { value, ...tags });
};
