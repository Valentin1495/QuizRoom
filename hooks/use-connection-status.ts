import { useEffect, useMemo, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase-api';

export type ConnectionPhase = 'connected' | 'connecting' | 'disconnected';

export interface ConnectionStatus {
    phase: ConnectionPhase;
    isWebSocketConnected: boolean;
    hasEverConnected: boolean;
    connectionCount: number;
    connectionRetries: number;
    hasInflightRequests: boolean;
    inflightMutations: number;
    inflightActions: number;
}

export function useConnectionStatus(): ConnectionStatus {
    const realtime = supabase.realtime as unknown as {
        isConnected?: () => boolean;
        isConnecting?: () => boolean;
    };

    const initialConnected = realtime.isConnected ? realtime.isConnected() : false;

    const [connectionInfo, setConnectionInfo] = useState(() => ({
        isWebSocketConnected: initialConnected,
        hasEverConnected: initialConnected,
        connectionCount: initialConnected ? 1 : 0,
        connectionRetries: 0,
    }));

    const hasEverRenderedConnectedRef = useRef(initialConnected);

    useEffect(() => {
        let prevIsConnected = realtime.isConnected ? realtime.isConnected() : false;

        const updateFromRealtime = () => {
            const isConnected = realtime.isConnected ? realtime.isConnected() : false;

            setConnectionInfo((prev) => {
                const hasEverConnected = prev.hasEverConnected || isConnected;
                let connectionCount = prev.connectionCount;
                let connectionRetries = prev.connectionRetries;

                if (!prevIsConnected && isConnected) {
                    connectionCount += 1;
                } else if (prevIsConnected && !isConnected && prev.hasEverConnected) {
                    connectionRetries += 1;
                }

                prevIsConnected = isConnected;

                return {
                    isWebSocketConnected: isConnected,
                    hasEverConnected,
                    connectionCount,
                    connectionRetries,
                };
            });
        };

        updateFromRealtime();
        const interval = setInterval(updateFromRealtime, 1000);

        return () => {
            clearInterval(interval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (connectionInfo.isWebSocketConnected) {
        hasEverRenderedConnectedRef.current = true;
    }

    const phase: ConnectionPhase = connectionInfo.isWebSocketConnected
        ? 'connected'
        : (realtime.isConnecting && realtime.isConnecting()) || connectionInfo.hasEverConnected || hasEverRenderedConnectedRef.current
          ? 'connecting'
          : 'disconnected';

    return useMemo(
        () => ({
            phase,
            isWebSocketConnected: connectionInfo.isWebSocketConnected,
            hasEverConnected: connectionInfo.hasEverConnected,
            connectionCount: connectionInfo.connectionCount,
            connectionRetries: connectionInfo.connectionRetries,
            // Supabase client doesn't expose per-request inflight metrics;
            // keep the shape but return neutral values.
            hasInflightRequests: false,
            inflightMutations: 0,
            inflightActions: 0,
        }),
        [phase, connectionInfo]
    );
}
