import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons'; // Assuming you use expo vector icons

type BoostProps = {
    type: 'fifty' | 'hint' | 'skip';
    count: number;
    onPress: () => void;
    disabled: boolean;
};

const BoostIcon = ({ type }: { type: 'fifty' | 'hint' | 'skip' }) => {
    switch (type) {
        case 'fifty':
            return <Text style={styles.iconText}>50:50</Text>;
        case 'hint':
            return <Feather name="help-circle" size={24} color="white" />;
        case 'skip':
            return <Feather name="skip-forward" size={24} color="white" />;
    }
};


const BoostButton: React.FC<BoostProps> = ({ type, count, onPress, disabled }) => {
    return (
        <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.container, disabled && styles.disabled]}>
            <View style={styles.iconContainer}>
                <BoostIcon type={type} />
            </View>
            <View style={styles.countContainer}>
                <Text style={styles.countText}>{count}</Text>
            </View>
        </TouchableOpacity>
    );
};

type BoostsContainerProps = {
    boosts: {
        fifty: number;
        hint: number;
        skip: number;
    };
    onUseBoost: (type: 'fifty' | 'hint' | 'skip') => void;
    disabled: boolean;
};

export const BoostsContainer: React.FC<BoostsContainerProps> = ({ boosts, onUseBoost, disabled }) => {
    return (
        <View style={styles.boostsRow}>
            <BoostButton type="fifty" count={boosts.fifty} onPress={() => onUseBoost('fifty')} disabled={disabled || boosts.fifty <= 0} />
            <BoostButton type="hint" count={boosts.hint} onPress={() => onUseBoost('hint')} disabled={disabled || boosts.hint <= 0} />
            <BoostButton type="skip" count={boosts.skip} onPress={() => onUseBoost('skip')} disabled={disabled || boosts.skip <= 0} />
        </View>
    );
}


const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        marginHorizontal: 10,
    },
    disabled: {
        opacity: 0.4,
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    countContainer: {
        position: 'absolute',
        top: -5,
        right: -5,
        backgroundColor: '#64FBD2',
        borderRadius: 10,
        paddingHorizontal: 5,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    countText: {
        color: '#0B0B14',
        fontWeight: 'bold',
        fontSize: 12,
    },
    boostsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 15,
    }
});

export default BoostButton;
