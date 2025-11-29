import React, { useState, useContext } from "react";
import { userDataContext } from "../context/userContext";
import axios from "axios"; 
import {MdKeyboardBackspace} from "react-icons/md"
import { useNavigate } from "react-router-dom";


function Customize2() {
    const { userData, backendImage, selectedImage, serverUrl , setUserData} = useContext(userDataContext);
  const [AssistantName, setAssistantName] = useState(userData?.AssistantName || "");
const [loading, setLoading] = useState(false)
const navigate= useNavigate()

  const handleUpdateAssistant= async ()=>{
    setLoading(true)
    try {
      let formData= new FormData()
      formData.append("assistantName", AssistantName)
      if(backendImage){
        formData.append("assistantImage", backendImage)
      }
      else{
        formData.append("imageUrl", selectedImage)
      }
      const result= await axios.post(`${serverUrl}/api/user/update`, formData, {withCredentials: true})
      setLoading(false)
      console.log(result.data)
      setUserData(result.data)
      navigate("/")
    } catch (error) {
      setLoading(false)
      console.log(error)
    }
  }

 

  return (
    <div className="w-full h-[100vh] bg-gradient-to-t from-black to-[#030353] flex flex-col justify-center items-center p-4 text-white relative">
      <MdKeyboardBackspace className="absolute top-[30px] cursor-pointer left-[30px] text-white w-[25px] h-[25px]" onClick={()=>navigate("/customize")}/>
      {/* Page Title */}
      <h1 className="text-[28px] md:text-[36px] font-semibold mb-8 text-center">
        Enter your <span className="text-blue-400">Virtual Assistant</span>
      </h1>

       <input
          type="text"
          value={AssistantName}
          onChange={(e) => setAssistantName(e.target.value)}
          placeholder="eg. Shifra"
         className="w-full max-w-[600px] h-[55px] rounded-full px-5 text-white text-[18px] font-medium outline-none border-2 border-white focus:border-blue-400 focus:shadow-[0_0_10px_#3b82f6] transition-all duration-200"

        />
       {AssistantName &&  <button
          type="submit"
          className="min-w-[150px] h-[55px] bg-white mt-[30px] text-black text-[18px] font-semibold rounded-full hover:bg-blue-100 active:scale-[0.98] transition-all duration-200" disabled={loading} onClick={()=>{handleUpdateAssistant() } } 
        >
          {!loading?"Save & Continue":"Loading..."}
        </button>
}
        
    </div>
  );
}

export default Customize2;
