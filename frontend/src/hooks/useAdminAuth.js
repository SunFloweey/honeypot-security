import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

/**
 * Hook per gestire autenticazione admin
 * Gestisce token, logout e redirect automatici
 */
export const useAdminAuth = () => {
    const navigate = useNavigate();

    const getToken = () => localStorage.getItem('adminToken');

    const logout = () => {
        localStorage.removeItem('adminToken');
        navigate('/researcher-login');
    };

    const checkAuth = (response) => {
        if (response.status === 401) {
            logout();
            return false;
        }
        return true;
    };

    // Redirect automatico se non autenticato
    useEffect(() => {
        if (!getToken()) {
            navigate('/researcher-login');
        }
    }, [navigate]);

    return { getToken, logout, checkAuth };
};