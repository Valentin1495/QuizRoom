'use client';

import { useRef } from 'react';

import { useRouter } from 'next/navigation';
import { AuthErrorCodes, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';

export default function Login() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);

  const signIn = async (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();

    if (emailRef && pwRef) {
      try {
        await signInWithEmailAndPassword(
          auth,
          emailRef.current!.value,
          pwRef.current!.value
        );
        router.push('/');
      } catch (error: any) {
        if (error.code == AuthErrorCodes.INVALID_PASSWORD) {
          alert('Wrong password. Try again.');
        } else {
          alert(`Error: ${error.message}`);
        }
      }
    }
  };

  const signup = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    router.push('/signup');
  };

  return (
    <div className='relative'>
      <img
        src='https://rb.gy/p2hphi'
        alt='bg'
        className='opacity-60 h-screen w-screen object-cover'
      />

      <img
        src='https://rb.gy/ulxxee'
        alt='Netflix Logo'
        className='w-32 h-16 lg:w-40 lg:h-20 absolute top-2 left-12'
      />

      <form className='flex justify-center'>
        <div className='w-80 sm:w-96 absolute top-40 rounded-md bg-black/80 flex flex-col items-center py-12 gap-y-8'>
          <h1 className='text-white font-bold text-3xl'>Sign In</h1>
          <div className='gap-y-4 flex flex-col items-center'>
            <input
              ref={emailRef}
              type='email'
              placeholder='Email'
              className='input'
            />
            {/* {email.length < 5 && <p className='error'>Please enter a valid email.</p>} */}

            <input
              ref={pwRef}
              type='password'
              placeholder='Password'
              className='input'
            />
            {/* {pw.length < 4 || pw.length > 60 && <p className='error'>Your password must contain between <br /> 4 and 60 characters.</p>} */}

            <button
              onClick={signIn}
              className='mt-5 bg-[#e50914] font-bold w-64 py-3 rounded-md text-white'
              type='submit'
            >
              Sign In
            </button>
            <div className='space-x-3 mt-2'>
              <span className='text-gray-400'>New to Netflix?</span>
              <button className='text-white hover:underline' onClick={signup}>
                Sign up now.
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
