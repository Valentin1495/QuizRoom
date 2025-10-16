import { useMemo, useRef } from 'react';
import { useConvexConnectionState } from 'convex/react';

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
    const connectionState = useConvexConnectionState();
    const hasEverRenderedConnectedRef = useRef(connectionState.isWebSocketConnected);
    if (connectionState.isWebSocketConnected) {
        hasEverRenderedConnectedRef.current = true;
    }

    const phase: ConnectionPhase = connectionState.isWebSocketConnected
        ? 'connected'
        : connectionState.hasEverConnected || hasEverRenderedConnectedRef.current
          ? 'connecting'
          : 'disconnected';

    return useMemo(
        () => ({
            phase,
            isWebSocketConnected: connectionState.isWebSocketConnected,
            hasEverConnected: connectionState.hasEverConnected,
            connectionCount: connectionState.connectionCount,
            connectionRetries: connectionState.connectionRetries,
            hasInflightRequests: connectionState.hasInflightRequests,
            inflightMutations: connectionState.inflightMutations,
            inflightActions: connectionState.inflightActions,
        }),
        [
            phase,
            connectionState.connectionCount,
            connectionState.connectionRetries,
            connectionState.hasEverConnected,
            connectionState.hasInflightRequests,
            connectionState.inflightActions,
            connectionState.inflightMutations,
            connectionState.isWebSocketConnected,
        ]
    );
}
