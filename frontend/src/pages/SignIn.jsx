import React, { useState, useContext } from "react";
import bg from '../assets/authBg.png'
import {IoEye} from 'react-icons/io5'
import {IoEyeOff} from 'react-icons/io5'
import { useNavigate } from 'react-router-dom'
import { userDataContext } from '../context/userContext'
import axios from "axios"



function SignIn() {
  const [showPassword, setshowPassword] = useState(false)
  const {serverUrl, userData, setUserData}= React.useContext(userDataContext);
  const navigate= useNavigate();
 const [loading, setLoading]= useState(false);
  const [email, setEmail]= useState("");
  const [password, setPassword]= useState("");
  const [err, setErr]= useState("");

  const handleSignIn= async(e)=>{
    e.preventDefault();
     setErr("");
      setLoading(true);
    try{
     
     let result = await axios.post(`${serverUrl}/api/auth/signin`, {
      email,password
     }, {withCredentials: true})
     setUserData(result.data);
     console.log(result)
      setLoading(false);
      navigate("/");

     
    } catch(error){
       console.log(error)
       setLoading(false);
       setUserData(null);
        setErr(error.response.data.message);
    }
  }
  
  return (
  <div className='w-full h-[100vh] bg-cover flex justify-center items-center' style={{backgroundImage: `url(${bg})`}}>

       <form className='w-[90%] h-[600px] max-w-[500px] backdrop-blur bg-[#00000062] shadow-lg shadow-black flex flex-col items-center justify-center gap-[20px] px-[20px]' onSubmit={handleSignIn}>
        <h1 className='text-white text-[30px] font-semibold mb-[30px]'>Sign In to <span className='text-blue-400'>Virtual Assistant</span></h1>
       
         <input type="email" placeholder='Email' className='w-full h-[60px] outline-none border-2 border-white bg-transparent text-white placeholder-gray-300 px-[20px] py-[10px] rounded-full text-[18px]'required onChange={(e)=>setEmail(e.target.value)} value={email} />
         <div className='w-full h-[60px] border-2 border-white bg-transparent text-white rounded-full text-[18px] relative '>
          <input type={showPassword?"text":"password"} placeholder='password' className='w-full h-full rounded-full outline-none bg-transparent placeholder-gray-300 px-[20px] px-[20px] py-[10px]'required onChange={(e)=>setPassword(e.target.value)} value={password} />
          {!showPassword &&  <IoEye className='absolute top-[18px] right-[20px] w-[25px] h-[25px] text-[white] cursor-pointer ' onClick={()=> setshowPassword(true)} />}
            {showPassword &&  <IoEyeOff className='absolute top-[18px] right-[20px] w-[25px] h-[25px] text-[white] cursor-pointer ' onClick={()=> setshowPassword(false)} />}
         
         </div>
         {err.length>0 && <p className='text-red-500 text-[17px]'>*{err}</p>}
         <button className='min-w-[150px] h-[60px] mt-[30px] text-black font-semibold bg-white rounded-full text-[19px] cursor-pointer disa' disabled={loading}>{loading?"Loading...":"Sign In"}</button>
         <p className='text-white text-[18px] cursor-pointer' onClick={()=>navigate("/signup")}>Want to create a new account ? <span className='text-blue-400'>Sign Up</span></p>
       </form>
    </div>
  )
}

export default SignIn
