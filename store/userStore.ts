import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Profile = {
    nickname: string | null;
    // Potentially more profile data here in the future
};

type UserState = {
    isFirstLaunch: boolean;
    profile: Profile;
    finishOnboarding: () => void;
    setProfile: (profile: Profile) => void;
};

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            isFirstLaunch: true,
            profile: {
                nickname: null,
            },
            finishOnboarding: () => set({ isFirstLaunch: false }),
            setProfile: (profile) => set({ profile }),
        }),
        {
            name: 'user-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
