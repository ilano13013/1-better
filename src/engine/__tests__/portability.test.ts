import { describe, expect, it } from 'vitest';
import { ABOUT, archiveFilename, archiveJson, buildArchive } from '../portability';
import { createInitialState, demoState } from '../../store/state';

describe('export des données', () => {
  const at = new Date('2026-09-24T08:30:00Z');

  it('restitue tout l’état, sans sélection', () => {
    const state = demoState();
    const archive = buildArchive(state, { version: '0.1.0' }, at);
    // Pas « quelques clés » : toutes. Une clé absente serait une donnée
    // détenue et non restituée, ce que l'article 15 interdit.
    expect(Object.keys(archive.data).sort()).toEqual(Object.keys(state).sort());
    expect(archive.data.profile).toEqual(state.profile);
    expect(archive.data.weightEntries).toEqual(state.weightEntries);
  });

  it('porte un en-tête lisible sans le code', () => {
    const archive = buildArchive(createInitialState(), { version: '0.1.0' }, at);
    expect(archive.format).toBe('one-better/export');
    expect(archive.exportedAt).toBe('2026-09-24T08:30:00.000Z');
    expect(archive.about).toEqual(ABOUT);
    expect(ABOUT.join(' ')).toMatch(/articles 15 et 20/);
  });

  it('nomme le compte sans exposer de secret', () => {
    const archive = buildArchive(createInitialState(), {
      version: '0.1.0',
      account: { provider: 'email', label: 'camille@exemple.fr' },
    }, at);
    expect(archive.account).toEqual({ provider: 'email', label: 'camille@exemple.fr' });
    expect(archiveJson(archive)).not.toMatch(/password|verifier|motDePasse/i);
  });

  it('produit un JSON relisible', () => {
    const state = demoState();
    const back = JSON.parse(archiveJson(buildArchive(state, { version: '0.1.0' }, at)));
    expect(back.data.profile.firstName).toBe(state.profile.firstName);
  });

  it('nomme le fichier par sa date', () => {
    expect(archiveFilename(new Date(2026, 8, 24))).toBe('1-better-mes-donnees-2026-09-24.json');
    expect(archiveFilename(new Date(2026, 0, 5))).toBe('1-better-mes-donnees-2026-01-05.json');
  });
});
