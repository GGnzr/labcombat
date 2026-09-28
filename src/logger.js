/**
 * Sistema Central de Logs e Diagnóstico do LabCombat
 * Registra eventos em tempo real para o painel do GM / Professor
 */

import { ref, push, set } from 'firebase/database';
import { db } from './firebase.js';

const MAX_LOGS = 120;
const PERSISTED_LOG_TYPES = new Set(['admin', 'error', 'warn']);
const logsHistory = [];

function normalizeLogData(value) {
    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
            stack: value.stack
        };
    }
    return value;
}

function persistLog(logItem) {
    if (!PERSISTED_LOG_TYPES.has(logItem.type)) return;

    const persistedData = {
        type: logItem.type,
        message: String(logItem.message || '').slice(0, 500),
        data: normalizeLogData(logItem.data),
        timestamp: logItem.timestamp,
        createdAt: Date.now()
    };

    try {
        const logRef = push(ref(db, 'logs'));
        set(logRef, persistedData).catch(() => {});
    } catch {
        // O diagnóstico local não deve falhar caso o Firebase esteja indisponível.
    }
}

/**
 * Registra um evento de diagnóstico
 * @param {'info'|'room'|'join'|'error'|'warn'|'game'} type 
 * @param {string} message 
 * @param {any} [data] 
 */
export function logEvent(type, message, data = null) {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    const logItem = {
        type: (type || 'info').toLowerCase(),
        message,
        data: normalizeLogData(data),
        timestamp,
        id: Date.now() + Math.random().toString(36).substring(2, 5)
    };

    logsHistory.push(logItem);
    if (logsHistory.length > MAX_LOGS) {
        logsHistory.shift();
    }

    const prefix = `[${timestamp}] [${logItem.type.toUpperCase()}]`;
    if (logItem.type === 'error') {
        console.error(prefix, message, logItem.data || '');
    } else if (logItem.type === 'warn') {
        console.warn(prefix, message, logItem.data || '');
    } else {
        console.log(prefix, message, logItem.data || '');
    }

    persistLog(logItem);

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('labcombat-log', { detail: logItem }));
    }

    return logItem;
}

export function getLogsHistory() {
    return [...logsHistory];
}

export function clearLogsHistory() {
    logsHistory.length = 0;
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('labcombat-logs-cleared'));
    }
}
