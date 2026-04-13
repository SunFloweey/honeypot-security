import { useNavigate } from 'react-router-dom';
import { useEffect, useCallback } from 'react';

/**
 * Hook per gestire autenticazione admin
 * Gestisce token, logout e redirect automatici
 */
export const useAdminAuth = () => {
    const navigate = useNavigate();

    const getToken = useCallback(() => {
        return localStorage.getItem('saasToken') || localStorage.getItem('adminToken');
    }, []);

    const getUser = useCallback(() => {
        const userJson = localStorage.getItem('user');
        return userJson ? JSON.parse(userJson) : null;
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('saasToken');
        localStorage.removeItem('user');
        navigate('/auth-portal');
    }, [navigate]);

    const checkAuth = useCallback((response) => {
        if (response.status === 401) {
            logout();
            return false;
        }
        return true;
    }, [logout]);

    // Redirect automatico rimosso per evitare loop infiniti o double-redirect.
    // Viene ora gestito centralmente nei componenti di routing o dashboard.
    /*
    useEffect(() => {
        if (!getToken()) {
            navigate('/auth-portal');
        }
    }, [navigate, getToken]);
    */

    return { getToken, getUser, logout, checkAuth };
};