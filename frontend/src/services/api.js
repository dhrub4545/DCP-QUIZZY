import { Platform } from 'react-native';
import Constants from 'expo-constants';
import axios from 'axios';

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
}

export function getAuthToken() {
  return authToken;
}

/**
 * Dynamically determine the backend server IP address.
 */
export function getBackendBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost;
  
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5000/api`;
    }
  }

  if (Platform.OS === 'android') {
    return 'http://192.168.100.14:5000/api';
  }

  return 'http://localhost:5000/api';
}

export const API_BASE_URL = getBackendBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
});

// Secure Request Interceptor: Attach JWT Bearer Token to all outgoing requests
api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Auth APIs
export const registerApi = async (userData) => {
  const response = await api.post('/auth/register', userData);
  if (response.data?.token) {
    setAuthToken(response.data.token);
  }
  return response.data;
};

export const loginApi = async (credentials) => {
  const response = await api.post('/auth/login', credentials);
  if (response.data?.token) {
    setAuthToken(response.data.token);
  }
  return response.data;
};

// Quiz APIs
export const fetchQuizzes = async () => {
  const response = await api.get('/quizzes');
  return response.data;
};

export const fetchQuizById = async (id) => {
  const response = await api.get(`/quizzes/${id}`);
  return response.data;
};

export const createQuizApi = async (quizData) => {
  const response = await api.post('/quizzes', quizData);
  return response.data;
};

export const updateQuizApi = async (id, quizData) => {
  const response = await api.put(`/quizzes/${id}`, quizData);
  return response.data;
};

export const fetchQuizSourcesApi = async () => {
  const response = await api.get('/quizzes/sources');
  return response.data;
};

export const generateCustomQuizApi = async (payload) => {
  const response = await api.post('/quizzes/generate-custom', payload);
  return response.data;
};

export const deleteQuiz = async (id) => {
  const response = await api.delete(`/quizzes/${id}`);
  return response.data;
};

export const addQuestionApi = async (quizId, questionData) => {
  const response = await api.post(`/quizzes/${quizId}/questions`, questionData);
  return response.data;
};

export const updateQuestionApi = async (quizId, questionId, questionData) => {
  const response = await api.put(`/quizzes/${quizId}/questions/${questionId}`, questionData);
  return response.data;
};

export const deleteQuestionApi = async (quizId, questionId) => {
  const response = await api.delete(`/quizzes/${quizId}/questions/${questionId}`);
  return response.data;
};

// History APIs
export const saveHistoryApi = async (attemptData) => {
  const response = await api.post('/history', attemptData);
  return response.data;
};

export const fetchHistoryApi = async () => {
  const response = await api.get('/history');
  return response.data;
};

export const fetchHistoryByIdApi = async (id) => {
  const response = await api.get(`/history/${id}`);
  return response.data;
};

export const deleteHistoryApi = async (id) => {
  const response = await api.delete(`/history/${id}`);
  return response.data;
};

// AI Engine APIs
export const fetchAiExplanationApi = async (questionData) => {
  const response = await api.post('/ai/explain', questionData);
  return response.data;
};

export const sendAiChatApi = async (chatPayload) => {
  const response = await api.post('/ai/chat', chatPayload);
  return response.data;
};

export const changePasswordApi = async (passwordData) => {
  const response = await api.post('/auth/change-password', passwordData);
  return response.data;
};

export default api;
