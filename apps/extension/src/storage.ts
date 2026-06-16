import { INITIAL_STATE } from './constants';
import type { ExtensionState } from './types';

const STORAGE_KEY = 'levelupAdsProExtensionState';

export async function getExtensionState(): Promise<ExtensionState> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return {
    ...INITIAL_STATE,
    ...(result[STORAGE_KEY] as Partial<ExtensionState> | undefined),
  };
}

export async function setExtensionState(state: ExtensionState) {
  await chrome.storage.local.set({
    [STORAGE_KEY]: state,
  });
}

export async function patchExtensionState(
  patch:
    | Partial<ExtensionState>
    | ((current: ExtensionState) => Partial<ExtensionState>),
) {
  const current = await getExtensionState();
  const nextPatch = typeof patch === 'function' ? patch(current) : patch;
  const nextState = {
    ...current,
    ...nextPatch,
  };

  await setExtensionState(nextState);
  return nextState;
}

export async function resetExtensionState() {
  await setExtensionState(INITIAL_STATE);
  return INITIAL_STATE;
}
