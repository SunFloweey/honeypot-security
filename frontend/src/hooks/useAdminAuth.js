import { useNavigate } from 'react-router-dom';
import { useEffect, useCallback } from 'react';

/**
 * Hook per gestire autenticazione admin
 * Gestisce token, logout e redirect automatici
 */
export const useAdminAuth = () => {
    const navigate = useNavigate();

    const getToken = useCallback(() => localStorage.getItem('adminToken'), []);

    const logout = useCallback(() => {
        localStorage.removeItem('adminToken');
        navigate('/researcher-login');
    }, [navigate]);

    const checkAuth = useCallback((response) => {
        if (response.status === 401) {
            logout();
            return false;
        }
        return true;
    }, [logout]);

    // Redirect automatico se non autenticato
    useEffect(() => {
        if (!getToken()) {
            navigate('/researcher-login');
        }
    }, [navigate, getToken]);

    return { getToken, logout, checkAuth };
};