#!/usr/bin/env node
/**
 * Range la racine du projet.
 *
 * Deux catégories de fichiers sont archivées dans `scripts/legacy/` :
 *
 *  1. Les outils de génération `patch_*` et `update_*` (en .py comme en .cjs),
 *     ainsi que quelques scripts de diagnostic jetables. Ils ont servi à
 *     construire l'application mais ne participent pas à son fonctionnement, et
 *     encombrent la racine (une cinquantaine de fichiers).
 *
 *  2. Les anciens `manifest.json` et `sw.js` de la racine. Vite ne copie dans
 *     `dist/` que le contenu de `public/` : à la racine, ces deux fichiers
 *     étaient absents du build (PWA non installable en production). Leurs
 *     versions à jour vivent désormais dans `public/`, et garder des copies à la
 *     racine expose au risque d'éditer le mauvais fichier.
 *
 * Rien n'est supprimé.
 *
 * Usage :
 *   node scripts/tidy-root.mjs          déplace les fichiers
 *   node scripts/tidy-root.mjs --dry    affiche ce qui serait déplacé
 */

import { mkdir, readdir, rename, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const legacyDir = join(scriptDir, 'legacy');
const publicDir = join(projectRoot, 'public');

const dryRun = process.argv.includes('--dry');

/** Fichiers désormais servis depuis public/ — à archiver seulement s'ils y existent. */
const SUPERSEDED_BY_PUBLIC = ['manifest.json', 'sw.js'];

/**
 * Scripts jetables nommés un par un.
 *
 * Ils ont servi à un diagnostic ponctuel et ne sont appelés par aucune commande
 * du projet : `dummy.py` est un fichier vide, `test_env.js` affiche une variable
 * d'environnement, `check_db.js` compte les lignes de trois tables (ce que
 * `psql` fait aussi bien), `fix_typecheck.py` corrigeait un lot d'erreurs de
 * types déjà résolues.
 */
const ONE_OFF_SCRIPTS = ['dummy.py', 'test_env.js', 'check_db.js', 'fix_typecheck.py', 'test-theme.js'];

/**
 * Un fichier de la racine est-il un outil de génération à archiver ?
 *
 * Les scripts de génération existent en `.py` et en `.cjs` — la première
 * version de ce script ne repérait que les `.py` et laissait sept `.cjs` sur
 * place.
 */
function isLegacyTool(name) {
  if (ONE_OFF_SCRIPTS.includes(name)) return true;
  return /^(patch|update)_.*\.(py|cjs|mjs|js)$/.test(name);
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Évite d'écraser un fichier déjà archivé : ajoute un suffixe numérique. */
async function resolveTarget(name) {
  let candidate = join(legacyDir, name);
  let counter = 1;

  while (true) {
    try {
      await stat(candidate);
    } catch {
      return candidate;
    }
    const dot = name.lastIndexOf('.');
    const base = dot === -1 ? name : name.slice(0, dot);
    const ext = dot === -1 ? '' : name.slice(dot);
    candidate = join(legacyDir, `${base}.${counter}${ext}`);
    counter += 1;
  }
}

const entries = await readdir(projectRoot, { withFileTypes: true });
const rootFiles = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));

const legacyTools = [...rootFiles].filter(isLegacyTool).sort();

// Ces deux fichiers ne sont archivés que si leur remplaçant existe bien dans
// public/ — sinon on retirerait de la racine la seule copie encore utile.
const duplicates = [];
for (const name of SUPERSEDED_BY_PUBLIC) {
  if (rootFiles.has(name) && (await exists(join(publicDir, name)))) {
    duplicates.push(name);
  } else if (rootFiles.has(name)) {
    console.warn(`  ! ${name} est à la racine mais absent de public/ — conservé par prudence.`);
  }
}

const targets = [...legacyTools, ...duplicates];

if (targets.length === 0) {
  console.log('Racine déjà propre : rien à archiver.');
  process.exit(0);
}

console.log(
  `${targets.length} fichier(s) à archiver dans scripts/legacy/${dryRun ? ' (simulation)' : ''} :`,
);
for (const name of legacyTools) console.log(`  ${name}`);
for (const name of duplicates) console.log(`  ${name}  (remplacé par public/${name})`);

if (dryRun) {
  console.log('\nSimulation : aucun fichier déplacé. Relance sans --dry pour appliquer.');
  process.exit(0);
}

await mkdir(legacyDir, { recursive: true });

let moved = 0;
for (const name of targets) {
  const target = await resolveTarget(name);
  try {
    await rename(join(projectRoot, name), target);
    moved += 1;
  } catch (error) {
    console.error(`  échec sur ${name} : ${error.message}`);
  }
}

console.log(`\n${moved} fichier(s) déplacé(s) vers scripts/legacy/.`);

// Ce rappel ne s'affiche que si le problème est réellement présent : un message
// qui décrit une situation révolue finit par être ignoré, y compris quand il a
// raison.
const LOCKFILES = ['bun.lock', 'bun.lockb', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'];
const presentLockfiles = LOCKFILES.filter((name) => rootFiles.has(name));

if (presentLockfiles.length > 1) {
  console.log(
    `\nRappel : ${presentLockfiles.length} fichiers de verrouillage coexistent ` +
      `(${presentLockfiles.join(', ')}). Garde celui du gestionnaire que tu utilises ` +
      'réellement et supprime les autres, sinon les installations divergeront selon\n' +
      'la machine.',
  );
}
