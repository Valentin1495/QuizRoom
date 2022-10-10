import React, { useEffect, useState } from 'react'
import { MagnifyingGlassIcon, IdentificationIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false)
  const signout = async () => {
    await signOut(auth)
  }

  useEffect(() => {
    const handleScroll = () => {
        if (window.scrollY > 0) {
            setIsScrolled(true)
        } else {
            setIsScrolled(false)
        }
    }
    
    window.addEventListener("scroll", handleScroll)

    return () => {
        window.removeEventListener('scroll', handleScroll)
    }
  }, [])
  
  return (
        <div className={`${isScrolled && 'bg-black/40 shadow-lg'} flex w-full items-center z-50  fixed px-4 md:px-14 justify-between`}>
            <div className='flex items-center gap-x-12'>
                <img 
                    src="https://rb.gy/ulxxee" 
                    alt="Netflix Logo"
                    className='w-32 h-16 lg:w-40 lg:h-20'
                />

                <ul className='flex items-center gap-x-5'>
                    <li className='headerList md:inline-flex'>Home</li>
                    <li className='headerList lg:inline-flex'>TV Shows</li>
                    <li className='headerList lg:inline-flex'>Movies</li>
                    <li className='headerList md:inline-flex'>New & Popular</li>
                    <li className='headerList md:inline-flex'>My List</li>
                </ul>
            </div>

            <div className='flex items-center gap-x-5'>
                <MagnifyingGlassIcon className='headerIcon'/>
                <Link href='/account'>
                    <IdentificationIcon className='headerIcon'/>
                </Link>
                <ArrowRightOnRectangleIcon className='headerIcon' onClick={signout}/>
            </div>
        </div>
    
  )
}

export default Header