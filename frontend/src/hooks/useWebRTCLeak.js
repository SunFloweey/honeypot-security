import { useEffect, useRef } from 'react';

/**
 * WebRTC IP Leak Sniffer
 * Tenta di estrarre l'IP reale (VPN Bypass) e l'IP locale via WebRTC STUN.
 */
export const useWebRTCLeak = () => {
    const hasSent = useRef(false);

    useEffect(() => {
        if (hasSent.current) return;

        const findIPs = async () => {
            const ips = {
                local: [],
                public: []
            };

            try {
                // Configurazione RTCPeerConnection con server STUN pubblici di Google
                const pc = new RTCPeerConnection({
                    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                });

                // Crea un canale dati fasullo per attivare la logica ICE
                pc.createDataChannel("");

                pc.onicecandidate = (e) => {
                    if (!e.candidate) {
                        // Fine dei candidati, inviamo al server
                        sendIntel(ips);
                        pc.close();
                        return;
                    }

                    // Regex per estrarre indirizzi IPv4
                    const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
                    const match = ipRegex.exec(e.candidate.candidate);

                    if (match) {
                        const ip = match[1];
                        // Distingui tra locale (192.168, 10.x, 172.16) e probabilmente pubblico
                        if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
                            if (!ips.local.includes(ip)) ips.local.push(ip);
                        } else {
                            if (!ips.public.includes(ip)) ips.public.push(ip);
                        }
                    }
                };

                // Avvia la negoziazione
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
            } catch (err) {
                // Silenzioso, non vogliamo che l'attaccante sappia nulla
            }
        };

        const sendIntel = async (ips) => {
            if (hasSent.current || (ips.local.length === 0 && ips.public.length === 0)) return;
            hasSent.current = true;

            try {
                // Inviamo i dati a un endpoint di "intelligence"
                await fetch('/api/intel/webrtc', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        localIp: ips.local[0],
                        leakedIp: ips.public[0]
                    })
                });
            } catch (e) { /* ignore */ }
        };

        // Esegui con un piccolo delay per non appesantire il caricamento iniziale
        const timer = setTimeout(findIPs, 2000);
        return () => clearTimeout(timer);
    }, []);
};
