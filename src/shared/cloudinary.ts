import { v2 as cloudinary } from "cloudinary";
import { UploadedFile } from "express-fileupload";

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
  });

const upload = (file: UploadedFile, location: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: location },
            (error, result) => {
                if (error) {
                    console.error('Cloudinary Upload Error:', error);
                    return reject(error);
                }
                if (result?.secure_url) {
                    resolve(result.secure_url);
                } else {
                    reject(new Error('Failed to get secure URL from Cloudinary response.'));
                }
            }
        );

        stream.end(file.data);
    });
};

const remove = async (fileUrl: string) => {
    try {
      const urlParts = new URL(fileUrl);
      const path = urlParts.pathname;
      
      const publicId = path.split('/').slice(2).join('/').replace(/\.[^/.]+$/, '');
      if (!publicId) {
        throw new Error('Unable to extract public ID from URL');
      }
      const result = await cloudinary.uploader.destroy(publicId);
      return result;
    } catch (error: any) {
      console.error('Error deleting file:', error.message);
      throw error;
    }
  };

const Cloudinary = {
  upload,
  remove,
}

export default Cloudinary;