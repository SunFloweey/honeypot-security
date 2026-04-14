import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import CONFIG from '../config';

const InteractiveTerminal = ({ sessionKey = 'default-session' }) => {
    const [history, setHistory] = useState([
        { type: 'system', content: 'Welcome to G-Tech Internal Audit Terminal v2.4.1' },
        { type: 'system', content: 'Authorized access only. All activities are logged.' }
    ]);
    const [input, setInput] = useState('');
    const [prompt, setPrompt] = useState('user@ubuntu:~$ ');
    const [loading, setLoading] = useState(false);
    const socketRef = useRef(null);
    const terminalEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        // Initialize WebSocket connection with auth token
        const token = localStorage.getItem('saasToken') || localStorage.getItem('adminToken');
        socketRef.current = io(CONFIG.WS_URL, {
            auth: { token }
        });

        socketRef.current.on('connect', () => {
            console.log('Connected to terminal WebSocket');
            socketRef.current.emit('init-terminal', { 
                sessionKey,
                context: { entryPath: window.location.pathname }
            });
        });

        socketRef.current.on('terminal-ready', (data) => {
            setPrompt(data.prompt);
        });

        socketRef.current.on('command-result', (data) => {
            setHistory(prev => [
                ...prev, 
                { type: 'output', content: data.output }
            ]);
            setPrompt(data.prompt);
            setLoading(false);
        });

        socketRef.current.on('terminal-error', (data) => {
            setHistory(prev => [...prev, { type: 'error', content: data.message }]);
            setLoading(false);
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, [sessionKey]);

    useEffect(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    const handleCommand = (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const cmd = input.trim();
        setHistory(prev => [...prev, { type: 'input', prompt, content: cmd }]);
        setInput('');
        setLoading(true);

        socketRef.current.emit('command', {
            sessionKey,
            command: cmd,
            context: { ip: 'detected', entryPath: window.location.pathname }
        });
    };

    const focusInput = () => {
        inputRef.current?.focus();
    };

    return (
        <div className="terminal-container" onClick={focusInput} style={{
            background: '#000',
            color: '#0f0',
            fontFamily: 'monospace',
            padding: '20px',
            borderRadius: '8px',
            height: '400px',
            overflowY: 'auto',
            border: '1px solid #333',
            fontSize: '14px',
            lineHeight: '1.4'
        }}>
            <div className="terminal-history">
                {history.map((line, i) => (
                    <div key={i} className={`terminal-line ${line.type}`}>
                        {line.type === 'input' && (
                            <span style={{ color: '#fff' }}>{line.prompt}</span>
                        )}
                        <pre style={{ 
                            display: 'inline', 
                            whiteSpace: 'pre-wrap', 
                            wordBreak: 'break-all',
                            margin: 0,
                            color: line.type === 'error' ? '#f00' : 
                                   line.type === 'system' ? '#0af' : 
                                   line.type === 'input' ? '#fff' : '#0f0'
                        }}>
                            {line.content}
                        </pre>
                    </div>
                ))}
                {loading && <div className="terminal-line system">Executing...</div>}
            </div>

            <form onSubmit={handleCommand} style={{ display: 'flex', marginTop: '10px' }}>
                <span style={{ color: '#fff', whiteSpace: 'nowrap', marginRight: '8px' }}>{prompt}</span>
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#fff',
                        outline: 'none',
                        width: '100%',
                        fontFamily: 'monospace',
                        fontSize: '14px'
                    }}
                    autoFocus
                    disabled={loading}
                />
            </form>
            <div ref={terminalEndRef} />
        </div>
    );
};

export default InteractiveTerminal;
