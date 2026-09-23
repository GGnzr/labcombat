/**
 * Sistema Central de Logs e Diagnóstico do LabCombat
 * Registra eventos em tempo real para o painel do GM / Professor
 */

const MAX_LOGS = 120;
const logsHistory = [];

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
        data,
        timestamp,
        id: Date.now() + Math.random().toString(36).substring(2, 5)
    };

    logsHistory.push(logItem);
    if (logsHistory.length > MAX_LOGS) {
        logsHistory.shift();
    }

    const prefix = `[${timestamp}] [${logItem.type.toUpperCase()}]`;
    if (logItem.type === 'error') {
        console.error(prefix, message, data || '');
    } else if (logItem.type === 'warn') {
        console.warn(prefix, message, data || '');
    } else {
        console.log(prefix, message, data || '');
    }

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
