// User types
export enum UserRole {
  ADMIN = 'ADMIN',
  FARMER = 'FARMER'
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface AuthResponse {
  token: string;
  username: string;
  email: string;
  role: UserRole;
}

// Crop types
export interface Crop {
  id: number;
  name: string;
  variety: string;
  area: number;
  plantingDate: string;
  harvestDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCropRequest {
  name: string;
  variety: string;
  area: number;
  plantingDate: string;
  harvestDate?: string;
  notes?: string;
}

// Activity types
export interface Activity {
  id: number;
  type: string;
  description: string;
  date: string;
  cropId: number;
  crop?: Crop;
  createdAt: string;
  updatedAt: string;
}

export interface CreateActivityRequest {
  type: string;
  description: string;
  date: string;
  cropId: number;
}

// Expense types
export interface Expense {
  id: number;
  expenseTitle: string;
  amount: number;
  category: string;
  description?: string;
  expenseDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseRequest {
  expenseTitle: string;
  amount: number;
  category: string;
  description?: string;
  expenseDate: string;
} 