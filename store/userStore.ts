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
    isGuest: boolean;
    guestId: string | null;
    finishOnboarding: () => void;
    setProfile: (profile: Profile) => void;
    setGuestId: (guestId: string) => void;
    login: () => void;
    logout: () => void;
};

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            isFirstLaunch: true,
            profile: {
                nickname: null,
            },
            isGuest: false,
            guestId: null,
            finishOnboarding: () => set({ isFirstLaunch: false }),
            setProfile: (profile) => set({ profile }),
            setGuestId: (guestId) => set({ isGuest: true, guestId }),
            login: () => set({ isGuest: false, guestId: null }),
            logout: () =>
                set({
                    isGuest: false,
                    guestId: null,
                    profile: { nickname: null },
                }),
        }),
        {
            name: 'user-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
