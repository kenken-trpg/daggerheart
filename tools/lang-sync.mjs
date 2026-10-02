/**
 * Japanese translation maintenance helper.
 *
 * `report`  shows how far lang/ja.json has drifted from lang/en.json after an
 *           upstream merge: keys to translate, keys upstream has dropped, and
 *           values still sitting on the English fallback.
 * `prepare` writes that drift to lang/translation/pending.json, pre-filling any
 *           value an approved glossary in lang/translation/glossary/ already
 *           answers, so only the genuinely new strings need a translator.
 * `apply`   merges lang/translation/pending.json back into lang/ja.json and
 *           rebuilds it in en.json's key order, dropping retired keys.
 *
 * Nothing here reaches out to the network. Glossaries are plain CSV checked in
 * by hand, so every imported wording stays reviewable in git history.
 */

import fs from 'fs/promises';
import path from 'path';

const LANG = 'lang';
const TRANSLATION = path.join(LANG, 'translation');
const GLOSSARY_DIR = path.join(TRANSLATION, 'glossary');
const PENDING = path.join(TRANSLATION, 'pending.json');

/* Strings that are the same in both languages by design. */
const NOT_TRANSLATABLE = /^(\s*|Daggerheart|Wiki|Discord|Lv|[A-Z]{1,3}|(?:\{\w+\}|\W)+)$/;

const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));

function flatten(object, prefix = '', out = {}) {
    for (const [key, value] of Object.entries(object)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, `${prefix}${key}.`, out);
        else out[prefix + key] = value;
    }
    return out;
}

/** Rebuild a flat key->value map into en.json's nested shape and key order. */
function nest(reference, values, prefix = '') {
    const out = {};
    for (const [key, value] of Object.entries(reference)) {
        const full = prefix + key;
        if (value && typeof value === 'object' && !Array.isArray(value)) out[key] = nest(value, values, `${full}.`);
        else out[key] = values[full] ?? value;
    }
    return out;
}

/**
 * Glossaries are matched on the English string rather than the key, so a wording
 * approved once carries over to every key that reuses it. Normalizing absorbs the
 * punctuation drift between the SRD, the CSV exports and en.json.
 */
const normalize = string =>
    String(string)
        .toLowerCase()
        .replace(/[−–—]/g, '-')
        .replace(/[‘’]/g, '\'')
        .replace(/\s+/g, ' ')
        .replace(/[.。]$/, '')
        .trim();

function parseCsv(text) {
    const rows = [];
    let row = [],
        field = '',
        quoted = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (quoted) {
            if (char !== '"') field += char;
            else if (text[i + 1] === '"') (field += '"'), i++;
            else quoted = false;
        } else if (char === '"') quoted = true;
        else if (char === ',') (row.push(field), (field = ''));
        else if (char === '\n') (row.push(field), rows.push(row), (row = []), (field = ''));
        else if (char !== '\r') field += char;
    }
    if (field || row.length) (row.push(field), rows.push(row));
    return rows;
}

/**
 * Every CSV in lang/translation/glossary/ maps an English string to a Japanese one
 * in its first two columns. Later files win, so an SRD-wide glossary can be dropped
 * in front of a narrower correction file by name.
 */
async function loadGlossaries() {
    const glossary = new Map();
    const sources = [];
    let files = [];
    try {
        files = (await fs.readdir(GLOSSARY_DIR)).filter(f => f.endsWith('.csv')).toSorted();
    } catch {
        return { glossary, sources };
    }
    for (const file of files) {
        const rows = parseCsv((await fs.readFile(path.join(GLOSSARY_DIR, file), 'utf8')).replace(/^﻿/, ''));
        let entries = 0;
        for (const [english, japanese] of rows.slice(1)) {
            if (!english?.trim() || !japanese?.trim()) continue;
            glossary.set(normalize(english), japanese.trim());
            entries++;
        }
        sources.push({ file, entries });
    }
    return { glossary, sources };
}

async function analyze() {
    const en = flatten(await readJson(path.join(LANG, 'en.json')));
    const ja = flatten(await readJson(path.join(LANG, 'ja.json')));

    const untranslated = Object.keys(en).filter(key => !(key in ja));
    const retired = Object.keys(ja).filter(key => !(key in en));
    const fallback = Object.keys(en).filter(
        key => key in ja && typeof en[key] === 'string' && en[key] === ja[key] && !NOT_TRANSLATABLE.test(en[key])
    );

    /* ja.json's own en->ja pairs are the house style, and outrank any glossary. */
    const established = new Map();
    for (const key of Object.keys(ja)) {
        if (typeof en[key] !== 'string' || typeof ja[key] !== 'string' || en[key] === ja[key]) continue;
        established.set(normalize(en[key]), ja[key]);
    }

    return { en, ja, untranslated, retired, fallback, established };
}

const commands = {
    async report() {
        const { en, untranslated, retired, fallback } = await analyze();
        const { sources } = await loadGlossaries();
        console.log(`en.json keys:    ${Object.keys(en).length}`);
        console.log(`to translate:    ${untranslated.length}`);
        console.log(`retired upstream: ${retired.length}`);
        console.log(`English fallback: ${fallback.length}`);
        console.log(
            `glossaries:      ${sources.length ? sources.map(s => `${s.file} (${s.entries})`).join(', ') : 'none'}`
        );
        for (const key of [...untranslated, ...fallback].slice(0, 20)) console.log(`  ${key}: ${en[key]}`);
    },

    async prepare() {
        const { en, untranslated, retired, fallback, established } = await analyze();
        const { glossary, sources } = await loadGlossaries();

        const pending = {};
        let prefilled = 0;
        for (const key of [...untranslated, ...fallback]) {
            const english = String(en[key]);
            const known = established.get(normalize(english)) ?? glossary.get(normalize(english));
            if (known) prefilled++;
            pending[key] = { en: english, ja: known ?? '' };
        }

        await fs.writeFile(PENDING, `${JSON.stringify({ retired, pending }, null, 4)}\n`);
        console.log(`${PENDING}: ${Object.keys(pending).length} entries, ${prefilled} pre-filled from`);
        console.log(`  established ja.json wordings and ${sources.length} glossary file(s)`);
        console.log(`Fill in the empty "ja" values, then run: node tools/lang-sync.mjs apply`);
    },

    async apply() {
        const reference = await readJson(path.join(LANG, 'en.json'));
        const ja = flatten(await readJson(path.join(LANG, 'ja.json')));
        const { pending } = await readJson(PENDING);

        let applied = 0;
        for (const [key, entry] of Object.entries(pending)) {
            if (!entry.ja?.trim()) continue;
            ja[key] = entry.ja;
            applied++;
        }

        /* Nesting against en.json drops retired keys and restores upstream ordering. */
        await fs.writeFile(path.join(LANG, 'ja.json'), `${JSON.stringify(nest(reference, ja), null, 4)}\n`);
        const skipped = Object.keys(pending).length - applied;
        console.log(`lang/ja.json updated: ${applied} applied${skipped ? `, ${skipped} still empty` : ''}`);
    }
};

const command = process.argv[2] ?? 'report';
if (!commands[command]) {
    console.error(`Usage: node tools/lang-sync.mjs [${Object.keys(commands).join('|')}]`);
    process.exit(1);
}
await commands[command]();
