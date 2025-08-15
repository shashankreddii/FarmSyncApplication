import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { 
  LoginRequest, RegisterRequest, AuthResponse,
  Crop, CreateCropRequest,
  Activity, CreateActivityRequest,
  Expense, CreateExpenseRequest
} from '../types';

export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8082/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests if available
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  console.log('API Request:', {
    url: config.url,
    token: token ? 'Present' : 'Missing',
    headers: config.headers
  });
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error: AxiosError) => {
  console.error('API Request Error:', error);
  return Promise.reject(error);
});

// Auth API
export const authAPI = {
  login: async (credentials: LoginRequest): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  register: async (userData: RegisterRequest): Promise<{ message: string }> => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },
};

// Crops API
export const cropsAPI = {
  getAll: async (): Promise<Crop[]> => {
    const response = await api.get('/crops');
    return response.data;
  },

  getById: async (id: number): Promise<Crop> => {
    const response = await api.get(`/crops/${id}`);
    return response.data;
  },

  create: async (crop: CreateCropRequest): Promise<Crop> => {
    const response = await api.post('/crops', crop);
    return response.data;
  },

  update: async (id: number, crop: Partial<CreateCropRequest>): Promise<Crop> => {
    const response = await api.put(`/crops/${id}`, crop);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/crops/${id}`);
  },
};

// Activities API
export const activitiesAPI = {
  getAll: async (): Promise<Activity[]> => {
    const response = await api.get('/activities');
    return response.data;
  },

  getById: async (id: number): Promise<Activity> => {
    const response = await api.get(`/activities/${id}`);
    return response.data;
  },

  create: async (activity: CreateActivityRequest): Promise<Activity> => {
    const response = await api.post('/activities', activity);
    return response.data;
  },

  update: async (id: number, activity: Partial<CreateActivityRequest>): Promise<Activity> => {
    const response = await api.put(`/activities/${id}`, activity);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/activities/${id}`);
  },
};

// Expenses API
export const expensesAPI = {
  getAll: async (): Promise<Expense[]> => {
    const response = await api.get('/expenses');
    return response.data;
  },

  getById: async (id: number): Promise<Expense> => {
    const response = await api.get(`/expenses/${id}`);
    return response.data;
  },

  create: async (expense: CreateExpenseRequest): Promise<Expense> => {
    const response = await api.post('/expenses', expense);
    return response.data;
  },

  update: async (id: number, expense: Partial<CreateExpenseRequest>): Promise<Expense> => {
    const response = await api.put(`/expenses/${id}`, expense);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/expenses/${id}`);
  }
};

export default api;