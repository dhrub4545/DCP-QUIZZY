// ----------------------------------------------------
// Global Centralized In-Memory Application State Cache
// Provides 0ms instant tab switching and zero-flicker transitions
// ----------------------------------------------------

let quizzesCache = null;
let historyCache = null;
let historyTotalCount = 0;
let userProfileCache = null;
let studyProgressCache = {};

export const getCachedQuizzes = () => quizzesCache;
export const setCachedQuizzes = (quizzes) => {
  quizzesCache = Array.isArray(quizzes) ? quizzes : [];
};

export const getCachedHistory = () => historyCache;
export const getCachedHistoryTotal = () => historyTotalCount;
export const setCachedHistory = (history, total = null) => {
  historyCache = Array.isArray(history) ? history : [];
  if (typeof total === 'number') {
    historyTotalCount = total;
  } else if (Array.isArray(history)) {
    historyTotalCount = history.length;
  }
};

export const appendCachedHistory = (newItems) => {
  if (!Array.isArray(historyCache)) {
    historyCache = [];
  }
  const existingIds = new Set(historyCache.map((item) => item._id));
  const uniqueItems = newItems.filter((item) => !existingIds.has(item._id));
  historyCache = [...historyCache, ...uniqueItems];
};

export const removeCachedHistoryItem = (id) => {
  if (Array.isArray(historyCache)) {
    historyCache = historyCache.filter((item) => item._id !== id);
    historyTotalCount = Math.max(0, historyTotalCount - 1);
  }
};

export const getCachedUserProfile = () => userProfileCache;
export const setCachedUserProfile = (user) => {
  if (user && typeof user === 'object') {
    userProfileCache = user;
  }
};

export const getCachedStudyProgress = () => studyProgressCache;
export const setCachedStudyProgress = (progress) => {
  if (progress && typeof progress === 'object') {
    studyProgressCache = progress;
  }
};

let studyStructureCache = null;

export const getCachedStudyStructure = () => studyStructureCache;
export const setCachedStudyStructure = (structure) => {
  if (structure && typeof structure === 'object') {
    studyStructureCache = structure;
  }
};

