import Head from 'next/head'
import { useRouter } from 'next/router'
import React from 'react'

const HomeScreen = () => {
  const router = useRouter()

  return (
    <div className='relative'>
      <Head>
        <title>Netflix South Korea - Watch TV Shows Online, Watch Movies Online</title>    
      </Head>

      <img src="https://rb.gy/p2hphi" alt="bg" className='opacity-60 h-screen w-screen object-cover'/>

      <img 
        src="https://rb.gy/ulxxee" 
        alt="Netflix Logo"
        className='w-32 h-16 lg:w-40 lg:h-20 absolute top-2 left-12'
      />

      <button 
        className='bg-[#e50914] rounded-sm px-4 py-1 absolute top-6 right-14 text-white'
        onClick={() => router.push("/login")}
      >
        Sign In
      </button>
      <div className='flex justify-center'>
        <div className='absolute top-1/3 flex flex-col items-center gap-y-5 px-6 text-center'>
          <h1 className='text-white text-3xl sm:text-5xl font-bold'>Unlimited movies, TV shows, and more.</h1>
          <p className='pg'>Watch anywhere. Cancel anytime.</p>
          <p className='pg'>Ready to watch? Enter your email to create or restart your membership.</p>
          <button 
            className='bg-[#e50914] rounded-sm px-6 py-3 text-white sm:text-3xl hover:bg-[#e50914]/70'
            onClick={() => router.push("/signup")}
          > 
            Get Started
          </button>
        </div>
      </div>
    </div>
  )
}

export default HomeScreen