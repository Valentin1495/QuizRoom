import React from 'react'
import { auth } from '../firebase'

const Account = () => {
  const user = auth.currentUser;
  let email;

  if (user !== null) {
     email = user.email;
  }

  return (
    <div className='text-white'>
        {email}    
    </div>
  )
}

export default Account