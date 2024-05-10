import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) {
            return null;
        }
        //upload file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
        });
        fs.unlinkSync(localFilePath);
        console.log("cloudinary response : ",response);
        //file uploaded successfully
        //delete file from local storage i.e. removing the locally saved file after uploadiing was successful
        return response;
        
    } catch (error) {
        fs.unlinkSync(localFilePath); //delete file from local storage i.e. removing the locally saved file after uploadiing was failed
        return null;
    }
};
export { uploadOnCloudinary };
