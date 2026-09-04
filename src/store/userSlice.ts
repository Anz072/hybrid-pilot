import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import type { DBUser } from "./DB_TYPES";
import { DB } from "./DB";

export type UserState = {
  currentUser: DBUser | null;
  status: "idle" | "loading" | "failed";
  hydrated: boolean;
  error: string | null;
};

const initialState: UserState = {
  currentUser: null,
  status: "idle",
  hydrated: false,
  error: null,
};

export const hydrateUserFromDb = createAsyncThunk(
  "user/hydrateUserFromDb",
  async () => {
    const user = await DB.getUser();
    return user;
  },
);

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setCurrentUser: (state, action: PayloadAction<DBUser | null>) => {
      state.currentUser = action.payload;
      state.hydrated = true;
      state.status = "idle";
      state.error = null;
    },
    clearCurrentUser: (state) => {
      state.currentUser = null;
      state.hydrated = true;
      state.status = "idle";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateUserFromDb.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(hydrateUserFromDb.fulfilled, (state, action) => {
        state.status = "idle";
        state.currentUser = action.payload;
        state.hydrated = true;
      })
      .addCase(hydrateUserFromDb.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message ?? "Failed to hydrate user";
        // `hydrated` means "we know who the user is, or that there is none".
        // A failed load means we know neither, so it stays false and the
        // navigator shows its error-and-retry screen.
        //
        // This used to be set to true, which was harmless while a local
        // database could answer instead. With the API as the only source, it
        // collapsed "the server is unreachable" into "signed out" — an outage
        // presented as the welcome screen, as though the account were gone.
        state.hydrated = false;
      });
  },
});

export const { setCurrentUser, clearCurrentUser } = userSlice.actions;

export default userSlice.reducer;
