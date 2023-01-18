'use client';

import { useAuth } from '../contexts/AuthContext';

export default function SignInScreen() {
  const auth = useAuth();
  console.log(auth?.isSignedIn);
  return <div></div>;
}
