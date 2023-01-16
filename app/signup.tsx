import { createUserWithEmailAndPassword } from "firebase/auth";
import Head from "next/head";
import { useRouter } from "next/router";
import React, { useRef } from "react";
import { auth } from "../firebase";

const SignUp = () => {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);

  const createAccount = async (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();

    if (emailRef && pwRef) {
      try {
        await createUserWithEmailAndPassword(
          auth,
          emailRef.current!.value,
          pwRef.current!.value
        );
        await router.push("/login");
        alert("Your account has been created successfully!");
      } catch (error: any) {
        alert(error.message);
      }
    }
  };

  return (
    <div className="bg-white h-screen overflow-hidden">
      <Head>
        <title>Netflix</title>
      </Head>
      <div className="py-2 px-6 flex justify-between border-b border-gray-200">
        <img
          src="https://rb.gy/ulxxee"
          alt="Netflix Logo"
          className="w-32 h-16 lg:w-40 lg:h-20"
        />

        <button
          className="hover:underline font-bold text-lg"
          onClick={() => router.push("/login")}
        >
          Sign In
        </button>
      </div>

      <div className="flex flex-col mx-auto gap-y-10 mt-20 px-8 w-96 sm:w-[500px]">
        <p className="text-3xl font-bold">
          Create an account to start your membership
        </p>
        <input
          ref={emailRef}
          type="email"
          placeholder="Email"
          className="signUp"
        />
        <input
          ref={pwRef}
          type="password"
          placeholder="Password"
          className="signUp"
        />
        <button
          className="w-full bg-[#e50914] py-4 rounded-sm text-2xl text-white"
          onClick={createAccount}
        >
          Sign Up
        </button>
      </div>
    </div>
  );
};

export default SignUp;
