import { useState, useEffect } from 'react';

/**
 * Hook per debouncare un valore.
 * Utile per evitare troppe richieste API durante l'input dell'utente.
 */
export const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};
