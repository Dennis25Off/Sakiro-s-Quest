import { SecretComboId } from './types';

export interface SecretComboMeta {
  id: SecretComboId;
  name: string;
  sequencePc: string;
  sequenceGp: string;
  effect: string;
}

export const SECRET_COMBOS: SecretComboMeta[] = [
  {
    id: 'breaker',
    name: 'Fendente Spezzaguardia',
    sequencePc: 'L · L · H',
    sequenceGp: 'X · X · Y',
    effect: 'Fendente verticale che frantuma la guardia nemica.',
  },
  {
    id: 'crimson_cross',
    name: 'Croce Cremisi',
    sequencePc: 'L · L · L · L · H',
    sequenceGp: 'X · X · X · X · Y',
    effect: 'Croce di energia rossa lunga 5,5 m che affetta ogni nemico.',
  },
  {
    id: 'tempest_whirl',
    name: "Turbine d'Acciaio",
    sequencePc: 'H · L · L',
    sequenceGp: 'Y · X · X',
    effect: 'Rotazione a 360° che travolge i nemici circostanti.',
  },
  {
    id: 'shadow_pierce',
    name: 'Lampo del Vuoto',
    sequencePc: 'Schiva · H',
    sequenceGp: 'B · Y',
    effect: 'Scatto perforante istantaneo subito dopo una schivata.',
  },
  {
    id: 'eclipse_judgment',
    name: "Giudizio dell'Eclissi",
    sequencePc: 'L · H · H',
    sequenceGp: 'X · Y · Y',
    effect: 'Schianto finale con ampia onda d’urto d’area.',
  },
  {
    id: 'moon_crescent',
    name: 'Falce Lunare',
    sequencePc: 'H · H',
    sequenceGp: 'Y · Y',
    effect: 'Lancia una mezzaluna energetica azzurra che trafigge a distanza.',
  },
  {
    id: 'thunder_descent',
    name: 'Furia del Tuono',
    sequencePc: 'Salta · H',
    sequenceGp: 'A · Y',
    effect: 'Schianto fulmineo dall’alto con onda d’urto elettrica d’area.',
  },
  {
    id: 'dragon_fang',
    name: 'Zanna del Drago',
    sequencePc: 'H · L · H',
    sequenceGp: 'Y · X · Y',
    effect: 'Affondo a spirale draconica che frantuma ogni difesa.',
  },
];

export const SECRET_COMBO_MAP: Record<SecretComboId, SecretComboMeta> = SECRET_COMBOS.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<SecretComboId, SecretComboMeta>,
);
