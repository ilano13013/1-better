import { describe, expect, it } from 'vitest';
import { COACH, instagramUrl } from '../../data/coach';

describe('caution professionnelle', () => {
  it('nomme la personne et son rôle', () => {
    expect(COACH.name.trim()).not.toBe('');
    expect(COACH.age).toBeGreaterThan(0);
    expect(COACH.role.trim()).not.toBe('');
  });

  it('n\'invente aucun intitulé de diplôme', () => {
    // Un diplôme non confirmé reste vide : écrire « BPJEPS » au hasard serait
    // une fausse déclaration de qualification, pas un détail de rédaction.
    const inventes = /BPJEPS|CQP|DEUST|STAPS|BEES|licence|master/i;
    expect(COACH.credential).not.toMatch(inventes);
  });

  it('énonce un périmètre, et ce qu\'il exclut', () => {
    expect(COACH.scope.length).toBeGreaterThanOrEqual(2);
    for (const line of COACH.scope) expect(line.trim().endsWith('.')).toBe(true);
    // Le hors-périmètre doit nommer la nutrition et la santé : sans cela, la
    // caution laisse croire qu'elles sont couvertes.
    expect(COACH.outOfScope).toMatch(/nutrition/i);
    expect(COACH.outOfScope).toMatch(/santé/i);
  });
});

describe('réseau social', () => {
  it('construit une adresse Instagram valable', () => {
    expect(instagramUrl('ddm_personal_trainer'))
      .toBe('https://www.instagram.com/ddm_personal_trainer/');
    // Une arobase saisie par habitude ne doit pas se retrouver dans l'URL.
    expect(instagramUrl('@ddm_personal_trainer'))
      .toBe('https://www.instagram.com/ddm_personal_trainer/');
  });

  it('renseigne le compte du coach', () => {
    expect(COACH.instagram).toBe('ddm_personal_trainer');
    expect(COACH.instagram).not.toMatch(/^@|\s|\//);
  });
});
