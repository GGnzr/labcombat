// Helpers compartilhados dos testes do LabCombat
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PUBLIC_DIR = path.join(ROOT, 'public');

export function publicPath(urlPath) {
    // '/assets/so/phaser/SO.png' -> <repo>/public/assets/so/phaser/SO.png
    return path.join(PUBLIC_DIR, ...urlPath.replace(/^\//, '').split('/'));
}

/** Existe o arquivo com o case EXATO? (Windows é case-insensitive; produção não) */
export function existsCaseSensitive(urlPath) {
    const rel = urlPath.replace(/^\//, '').split('/');
    let dir = PUBLIC_DIR;
    for (let i = 0; i < rel.length - 1; i++) {
        if (!fs.existsSync(dir)) return false;
        const entries = fs.readdirSync(dir);
        if (!entries.includes(rel[i])) return false;
        dir = path.join(dir, rel[i]);
    }
    const name = rel[rel.length - 1];
    return fs.existsSync(dir) && fs.readdirSync(dir).includes(name);
}

/** Lê um JSON do disco (tolerando BOM). */
export function readJson(absPath) {
    return JSON.parse(fs.readFileSync(absPath, 'utf-8').replace(/^﻿/, ''));
}

/** Lista frames (chaves) de um atlas JSON do Phaser. */
export function atlasFrameNames(urlPath) {
    const data = readJson(publicPath(urlPath));
    return Object.keys(data.frames || {});
}
