import { create } from 'zustand';

export interface AuthUser {
  id?: string | number;
  username?: string;
  name?: string;
  role?: string;
  [key: string]: any;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (userData: AuthUser) => void;
  logout: () => void;
  initializeAuth: () => void;
}

const storedUser = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
let parsedUser: AuthUser | null = null;
try {
  parsedUser = storedUser ? JSON.parse(storedUser) : null;
} catch (e) {
  parsedUser = null;
}

const useAuthStore = create<AuthState>((set) => ({
  user: parsedUser,
  isAuthenticated: !!parsedUser,
  
  login: (userData: AuthUser) => {
    set({
      user: userData,
      isAuthenticated: true
    });
    localStorage.setItem('user', JSON.stringify(userData));
  },
  
  logout: () => {
    set({
      user: null,
      isAuthenticated: false
    });
    localStorage.removeItem('user');
  },
  
  initializeAuth: () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        set({
          user: JSON.parse(storedUser),
          isAuthenticated: true
        });
      } catch (e) {
        console.error(e);
      }
    }
  }
}));

export { useAuthStore };
