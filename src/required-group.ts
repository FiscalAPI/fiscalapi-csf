/**
 * Elemento obligatorio de un resultado de regex (un grupo de captura o su rango de índices). Si falta, el patrón
 * está mal escrito (error de programación), no es un dato inválido de la constancia. El mensaje no incluye el
 * texto analizado porque contiene datos personales del contribuyente.
 */
export function requiredGroup<T>(groups: readonly (T | undefined)[], index: number): T {
  const value = groups[index];
  if (value === undefined) throw new Error(`Un patrón de la CSF no capturó el grupo ${String(index)}.`);
  return value;
}
