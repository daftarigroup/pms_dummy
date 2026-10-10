import { Toaster } from '@/components/ui/sonner';
import type { UserPermissions } from '@/types/sheets';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { authenticateUser, getUserByUsername } from '@/services/userService';
import { CHECKLIST_TOKEN_KEY } from '@/lib/checklistApiClient';

interface AuthState {
    loggedIn: boolean;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    refreshUser: () => Promise<void>;
    loading: boolean;
    user: UserPermissions;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [loggedIn, setLoggedIn] = useState(false);
    const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const stored = localStorage.getItem('auth');
        if (stored) {
            try {
                const { username } = JSON.parse(stored);
                getUserByUsername(username).then((user) => {
                    if (user) {
                        setUserPermissions(user);
                        setLoggedIn(true);
                    } else {
                        // User not found or error
                        localStorage.removeItem('auth');
                        localStorage.removeItem(CHECKLIST_TOKEN_KEY);
                    }
                    setLoading(false);
                }).catch((error) => {
                    console.error('Error fetching user data:', error);
                    localStorage.removeItem('auth');
                    localStorage.removeItem(CHECKLIST_TOKEN_KEY);
                    setLoading(false);
                });
            } catch (error) {
                console.error('Error parsing stored auth data:', error);
                localStorage.removeItem('auth');
                localStorage.removeItem(CHECKLIST_TOKEN_KEY);
                setLoading(false);
            }
        } else {
            setLoading(false);
        }
    }, []);

    async function login(username: string, password: string) {
        try {
            const user = await authenticateUser(username, password);
            if (!user) {
                return false;
            }

            localStorage.setItem('auth', JSON.stringify({ username }));
            setUserPermissions(user);
            setLoggedIn(true);
            return true;
        } catch (error) {
            console.error('Error during login:', error);
            return false;
        }
    }

    async function refreshUser() {
        const stored = localStorage.getItem('auth');
        if (!stored) return;

        try {
            const { username } = JSON.parse(stored);
            const user = await getUserByUsername(username);
            if (user) {
                setUserPermissions(user);
                setLoggedIn(true);
            } else {
                logout();
            }
        } catch (error) {
            console.error('Error refreshing user data:', error);
        }
    }

    function logout() {
        localStorage.removeItem('auth');
        localStorage.removeItem(CHECKLIST_TOKEN_KEY);
        setLoggedIn(false);
        setUserPermissions(null);
    }

    // Create a default user object to prevent undefined errors and allow full access in dummy mode
    const defaultUser: UserPermissions = userPermissions || {
        username: 'Admin',
        name: 'Admin User',
        role: 'Admin',
        firm_access: 'All',
        administrate: true,
        indentApprovalAction: true,
        roles: ['Admin'],
        store: {
            all: true,
            indent: true,
            approveIndent: true,
            pendingIndents: true,
            vendorBidding: true,
            quotation: true,
            technicalApproval: true,
            rateApproval: true,
            vendorUpdate: true,
            createPo: true,
            pendingPo: true,
            order: true,
            poMaster: true,
        }
    } as any;

    return (
        <AuthContext.Provider value={{
            login,
            loggedIn: true,
            logout,
            refreshUser,
            user: defaultUser,
            loading: false
        }}>
            {children}
            <Toaster expand richColors theme="light" closeButton />
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
