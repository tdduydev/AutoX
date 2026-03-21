import { create } from 'zustand';

interface User {
  sub: string;
  email: string;
  role: string;
  name?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('xclaw_token'),
  loading: true,
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('xclaw_token', token);
    } else {
      localStorage.removeItem('xclaw_token');
    }
    set({ token });
  },
  setLoading: (loading) => set({ loading }),
  logout: () => {
    localStorage.removeItem('xclaw_token');
    set({ user: null, token: null });
  },
}));
