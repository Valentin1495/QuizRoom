import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

export interface UserState {
  user: Object | null
}

const initialState: UserState = {
  user: null,
}

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    signin: (state, action: PayloadAction<Object>) => {
      state.user = action.payload
    },
    signout: state => {
        state.user = null
    }
  },
})

// Action creators are generated for each case reducer function
export const { signin, signout } = userSlice.actions

export default userSlice.reducer