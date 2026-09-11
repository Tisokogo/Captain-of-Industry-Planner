import type { PlanState } from '../../types';

function lzwPack(text: string) {
  const bytes = new TextEncoder().encode(text);
  let input = '';
  for (const byte of bytes) input += String.fromCharCode(byte);
  const dictionary = new Map<string, number>();
  for (let index = 0; index < 256; index += 1) {
    dictionary.set(String.fromCharCode(index), index);
  }

  let phrase = '';
  let nextCode = 256;
  const codes: number[] = [];
  for (const character of input) {
    const joined = phrase + character;
    if (dictionary.has(joined)) {
      phrase = joined;
    } else {
      codes.push(dictionary.get(phrase)!);
      if (nextCode < 65_535) dictionary.set(joined, nextCode++);
      phrase = character;
    }
  }
  if (phrase) codes.push(dictionary.get(phrase)!);

  let binary = '';
  for (const code of codes) binary += String.fromCharCode(code >> 8, code & 255);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function lzwUnpack(value: string) {
  const binary = atob(
    value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  );
  const codes: number[] = [];
  for (let index = 0; index < binary.length; index += 2) {
    codes.push((binary.charCodeAt(index) << 8) | binary.charCodeAt(index + 1));
  }
  if (!codes.length) return '';

  const dictionary = new Map<number, string>();
  for (let index = 0; index < 256; index += 1) {
    dictionary.set(index, String.fromCharCode(index));
  }

  let nextCode = 256;
  let phrase = dictionary.get(codes[0])!;
  let output = phrase;
  for (let index = 1; index < codes.length; index += 1) {
    const code = codes[index];
    const entry = dictionary.get(code) ?? (code === nextCode ? phrase + phrase[0] : '');
    if (!entry) throw new Error('INVALID_LZW_STREAM');
    output += entry;
    if (nextCode < 65_535) dictionary.set(nextCode++, phrase + entry[0]);
    phrase = entry;
  }
  return new TextDecoder().decode(Uint8Array.from(output, (character) => character.charCodeAt(0)));
}

export function encodeState(state: PlanState) {
  return `z${lzwPack(JSON.stringify(state))}`;
}

export function decodeState(value: string): PlanState | null {
  try {
    return value.startsWith('z')
      ? (JSON.parse(lzwUnpack(value.slice(1))) as PlanState)
      : (JSON.parse(decodeURIComponent(escape(atob(value)))) as PlanState);
  } catch {
    return null;
  }
}

export function stateFromHash(): PlanState | null {
  if (!location.hash.startsWith('#p=')) return null;
  return decodeState(location.hash.slice(3));
}
