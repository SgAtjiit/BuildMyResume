import { v2 as cloudinary} from "cloudinary";
import fs from "fs"





const uploadOnCloudinary = async (localFilePath) =>{
    cloudinary.config({
    cloud_name:process.env.CLOUDINARY_CLOUD_NAME,
    api_key:process.env.CLOUDINARY_API_KEY,
    api_secret:process.env.CLOUDINARY_API_SECRET
})
    try {
        if(!localFilePath)return null
        //upload file
        // console.log("Here at cloudinary.js :",localFilePath)
        const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type:"auto"
        })
        // console.log("Response : ",response)
        //file uploaded successfully
        // console.log("File is uploaded successfully on cloudinary!!",response.url)
        fs.unlinkSync(localFilePath)
        return response
    } catch (error) {
        fs.unlinkSync(localFilePath)
        //remove the locally saved temp file as the upload failed
        return null
    }
}

export {uploadOnCloudinary}