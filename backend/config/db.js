import mongoose from "mongoose";

const connectDb=async()=>{
    try{
        await mongoose.connect(process.env.MONGODB_URL)
            console.log("MongoDB connected successfully");
        }
       
    catch(error){
        console.error("MongoDB connection failed:",error.message);
        
    } 
  }

  export default connectDb;