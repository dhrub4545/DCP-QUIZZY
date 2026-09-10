import AsyncStorage from '@react-native-async-storage/async-storage';

const PROGRESS_KEY_PREFIX = '@quizzy_study_progress_v1_';

// In-memory fallback map if native storage module is null in Expo Go
const memoryStore = {};

const getStorageItem = async (key) => {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      const val = globalThis.localStorage.getItem(key);
      if (val !== null && val !== undefined) return val;
    }
  } catch (e) {}

  try {
    if (AsyncStorage) {
      const val = await AsyncStorage.getItem(key);
      if (val !== null && val !== undefined) return val;
    }
  } catch (e) {}

  return memoryStore[key] || null;
};

const setStorageItem = async (key, value) => {
  let saved = false;
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      globalThis.localStorage.setItem(key, value);
      saved = true;
    }
  } catch (e) {}

  if (!saved) {
    try {
      if (AsyncStorage) {
        await AsyncStorage.setItem(key, value);
        saved = true;
      }
    } catch (e) {}
  }

  memoryStore[key] = value;
};

const getAllKeys = async () => {
  const keysSet = new Set();

  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      for (let i = 0; i < globalThis.localStorage.length; i++) {
        const k = globalThis.localStorage.key(i);
        if (k) keysSet.add(k);
      }
    }
  } catch (e) {}

  try {
    if (AsyncStorage) {
      const nativeKeys = await AsyncStorage.getAllKeys();
      if (nativeKeys && Array.isArray(nativeKeys)) {
        nativeKeys.forEach((k) => keysSet.add(k));
      }
    }
  } catch (e) {}

  Object.keys(memoryStore).forEach((k) => keysSet.add(k));

  return Array.from(keysSet);
};

/**
 * Save study progress bookmark for a specific book or topic
 */
export async function saveStudyProgress(bookId, progressData) {
  if (!bookId) return;
  try {
    const key = `${PROGRESS_KEY_PREFIX}${bookId}`;
    const payload = JSON.stringify({
      ...progressData,
      updatedAt: new Date().toISOString(),
    });
    await setStorageItem(key, payload);
  } catch (err) {
    // Silent fail protection
  }
}

/**
 * Get study progress bookmark for a specific book or topic
 */
export async function getStudyProgress(bookId) {
  if (!bookId) return null;
  try {
    const key = `${PROGRESS_KEY_PREFIX}${bookId}`;
    const jsonStr = await getStorageItem(key);
    if (jsonStr) {
      return JSON.parse(jsonStr);
    }
  } catch (err) {
    // Silent fail protection
  }
  return null;
}

/**
 * Get study progress for all books/topics
 */
export async function getAllStudyProgress() {
  try {
    const keys = await getAllKeys();
    const progressKeys = keys.filter((k) => k.startsWith(PROGRESS_KEY_PREFIX));
    if (progressKeys.length === 0) return {};

    const result = {};
    for (const key of progressKeys) {
      const val = await getStorageItem(key);
      if (val) {
        const bookId = key.replace(PROGRESS_KEY_PREFIX, '');
        try {
          result[bookId] = JSON.parse(val);
        } catch (e) {}
      }
    }
    return result;
  } catch (err) {
    return {};
  }
}

const STUDY_STRUCTURE_KEY = '@quizzy_study_structure_v1';

/**
 * Preserve Study Folders and File Lists locally for instant 0ms offline/startup loading
 */
export async function savePreservedStudyStructure(structureData) {
  if (!structureData) return;
  try {
    const payload = JSON.stringify({
      ...structureData,
      cachedAt: new Date().toISOString(),
    });
    await setStorageItem(STUDY_STRUCTURE_KEY, payload);
  } catch (err) {
    console.warn('Error preserving study structure:', err.message);
  }
}

/**
 * Retrieve Preserved Study Folders and File Lists from local storage
 */
export async function getPreservedStudyStructure() {
  try {
    const jsonStr = await getStorageItem(STUDY_STRUCTURE_KEY);
    if (jsonStr) {
      return JSON.parse(jsonStr);
    }
  } catch (err) {
    console.warn('Error reading preserved study structure:', err.message);
  }
  return null;
}

