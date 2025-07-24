const imagekit = require("../utils/imagekit");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const tmp = require("tmp");
const fs = require("fs");

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const uploadImage = async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const isImage = file.mimetype.startsWith("image");
  const isVideo = file.mimetype.startsWith("video");

  try {
    let bufferToUpload;
    let base64data;

    if (isImage) {
      bufferToUpload = await sharp(file.buffer)
        .resize({ width: 1280 }) 
        .jpeg({ quality: 75 })   
        .toBuffer();

      base64data = bufferToUpload.toString("base64");
    } else if (isVideo) {
      const inputPath = tmp.tmpNameSync({ postfix: ".mp4" });
      const outputPath = tmp.tmpNameSync({ postfix: ".mp4" });

      fs.writeFileSync(inputPath, file.buffer);

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions([
            "-vf scale=1280:-2",    
            "-crf 28",                
            "-preset veryfast"       
          ])
          .on("end", resolve)
          .on("error", reject)
          .save(outputPath);
      });

      const compressedVideo = fs.readFileSync(outputPath);
      base64data = compressedVideo.toString("base64");

      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    const result = await imagekit.upload({
      file: base64data,
      fileName: `${Date.now()}-${file.originalname}`,
      folder:
        req.query.type === "profile" ? "/profile" : req.query.type === "post"? "/posts": "/others",
    });

    res.status(200).json({
      url: result.url,
      fileId: result.fileId,
      type: isImage ? "image" : "video",
    });
  } catch (error) {
    console.error("Upload failed:", error);
    res.status(500).json({ error: "Upload failed", details: error.message });
  }
};

module.exports = { uploadImage };
