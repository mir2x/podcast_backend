import to from "await-to-ts";
import { NextFunction, Request, Response } from "express";
import { getAudioMetadata, getImageMetadata } from "@utils/extractMetadata";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

import Podcast from "@models/podcast";
import Category from "@models/category";
import SubCategory from "@models/subCategory";
import Creator from "@models/creator";

import mongoose from "mongoose";
import httpStatus from "http-status";
import createError from "http-errors";
import { addPodcast } from "@controllers/history";
import Like from "@models/like";
import Favorite from "@models/favorite";
import { PodcastSchema } from "@schemas/podcast";

import Report from "@models/report";

type PodcastFiles = Express.Request & {
  files: { [fieldname: string]: Express.Multer.File[] };
};

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const create = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const { categoryId, subCategoryId, title, description, location } = req.body;
  const { audio, cover } = (req as any).files;
  const creatorId = req.user.creatorId;

  let error, category, subCategory;

  [error, category] = await to(Category.findById(categoryId));
  if (error) return next(error);
  if (!category) return next(createError(httpStatus.NOT_FOUND, "Category Not Found"));

  [error, subCategory] = await to(SubCategory.findById(subCategoryId));
  if (error) return next(error);
  if (!subCategory) return next(createError(httpStatus.NOT_FOUND, "SubCategory Not Found"));

  const audioLocalPath = audio[0].path;
  const coverPath = cover[0].path;

  let audioCloudinaryUrl: string;

  try {
    const cloudinaryResponse = await cloudinary.uploader.upload(audioLocalPath, {
      resource_type: "video",
      folder: "uploads/podcast/audio",
    });
    audioCloudinaryUrl = cloudinaryResponse.secure_url;
  } catch (uploadError) {
    console.error("Cloudinary upload error:", uploadError);
    return next(createError(httpStatus.INTERNAL_SERVER_ERROR, "Audio upload to Cloudinary failed"));
  }

  const audioMetadata = await getAudioMetadata(audioCloudinaryUrl);
  const imageMetadata = await getImageMetadata(coverPath);

  const session = await mongoose.startSession();
  session.startTransaction();
  let podcast;
  try {
    podcast = await Podcast.create({
      creator: creatorId,
      category: categoryId,
      subCategory: subCategoryId,
      title,
      description,
      location,
      cover: coverPath,
      coverFormat: imageMetadata.format,
      coverSize: imageMetadata.size,
      audio: audioCloudinaryUrl,
      audioFormat: audioMetadata.format,
      audioSize: audioMetadata.size,
      audioDuration: audioMetadata.duration,
    });

    await Creator.findByIdAndUpdate(creatorId, { $push: { podcasts: podcast._id } });
    await SubCategory.findByIdAndUpdate(subCategoryId, { $push: { podcasts: podcast._id } });

    await session.commitTransaction();
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    return next(error);
  } finally {
    session.endSession();
  }

  return res
    .status(httpStatus.CREATED)
    .json({ success: true, message: "Podcast created successfully", data: podcast });
};

const get = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const { id } = req.params;
  const [error, podcast] = await to(
    Podcast.findById(id)
      .populate({
        path: "creator",
        select: "user -_id",
        populate: {
          path: "user",
          select: "name -_id",
        },
      })
      .populate({
        path: "category",
        select: "title",
      })
      .populate({
        path: "subCategory",
        select: "title",
      })
      .lean(),
  );
  if (error) return next(error);
  if (!podcast) return next(createError(httpStatus.NOT_FOUND, "Podcast Not Found"));
  return res.status(httpStatus.OK).json({ success: true, message: "Success", data: podcast });
};

const getAll = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.max(Number(req.query.limit) || 10, 1);

  const skip = (page - 1) * limit;

  if (page <= 0 || limit <= 0) {
    return next(createError(httpStatus.BAD_REQUEST, "Invalid pagination parameters"));
  }

  const [error, podcasts] = await to(
    Podcast.find()
      .skip(skip)
      .limit(limit)
      .populate({
        path: "creator",
        select: "user -_id",
        populate: {
          path: "user",
          select: "name -_id",
        },
      })
      .populate({
        path: "category",
        select: "title",
      })
      .populate({
        path: "subCategory",
        select: "title",
      })
      .lean(),
  );

  if (error) return next(error);

  if (!podcasts || podcasts.length === 0) {
    return res.status(httpStatus.OK).json({
      success: true,
      message: "No Podcast Found!",
      data: [],
      pagination: {
        page,
        limit,
        total: await Podcast.countDocuments(),
      },
    });
  }

  const formattedPodcasts = podcasts.map((podcast: any) => ({
    ...podcast,
    audioDuration: (podcast.audioDuration / 60).toFixed(2) + " min",
  }));

  return res.status(httpStatus.OK).json({
    success: true,
    message: "Success",
    data: formattedPodcasts,
    pagination: {
      page,
      limit,
      total: await Podcast.countDocuments(), // Total number of documents
    },
  });
};

const update = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const { categoryId, subCategoryId, title, description, location } = req.body;
  const { cover } = (req as PodcastFiles).files;
  let error, podcast;
  const { id } = req.params;

  const updateFields: {
    category?: string;
    subCategory?: string;
    title?: string;
    description?: string;
    location?: string;
    cover?: string;
  } = {};

  if (categoryId) {
    let category;
    [error, category] = await to(Category.findById(categoryId));
    if (error) return next(error);
    if (!category) return next(createError(httpStatus.NOT_FOUND, "Category not found!"));
    updateFields.category = categoryId;
  }
  if (subCategoryId) {
    let subCategory;
    [error, subCategory] = await to(SubCategory.findById(subCategoryId));
    if (error) return next(error);
    if (!subCategory) return next(createError(httpStatus.NOT_FOUND, "subCategory not found!"));
    updateFields.subCategory = subCategoryId;
  }
  if (title) updateFields.title = title;
  if (description) updateFields.description = description;
  if (location) updateFields.location = location;
  if (cover) updateFields.cover = cover[0].path;

  [error, podcast] = await to(Podcast.findByIdAndUpdate(id, { $set: updateFields }, { new: true }));
  if (error) return next(error);
  res.status(httpStatus.OK).json({ success: true, message: "Success", data: podcast });
};

const remove = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  let error, podcast;
  const { id } = req.params;

  [error, podcast] = await to(Podcast.findById(id));
  if (error) return next(error);
  if (!podcast) return res.status(400).json({ error: "Podcast Not Found" });

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    if (podcast.audio) {
      const audioPublicId = getCloudinaryPublicId(podcast.audio);
      console.log(audioPublicId);
      await cloudinary.uploader.destroy(audioPublicId, {
        resource_type: "video",
      });
    }

    if (podcast.cover) {
      const coverPath = path.resolve(podcast.cover);
      fs.unlink(coverPath, (err) => {
        if (err) {
          console.error("Failed to delete cover file locally:", err);
        }
      });
    }

    await Creator.findByIdAndUpdate(podcast.creator, { $pull: { podcasts: id } });
    await SubCategory.findByIdAndUpdate(podcast.subCategory, { $pull: { podcasts: id } });

    await Podcast.findByIdAndDelete(id);

    await session.commitTransaction();
    session.endSession();
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
      session.endSession();
    }
    return next(error);
  }

  res.status(httpStatus.OK).json({ success: true, message: "Podcast deleted successfully" });
};

const getCloudinaryPublicId = (url: string): string => {
  const parts = url.split("/");
  const filenameWithExt = parts[parts.length - 1];
  const [filename] = filenameWithExt.split(".");
  return parts
    .slice(parts.length - 2, parts.length - 1)
    .concat(filename)
    .join("/");
};

export const updateLikeCount = async (podcastId: string, value: number): Promise<number> => {
  const podcast = await Podcast.findByIdAndUpdate(
    podcastId,
    { $inc: { totalLikes: value } },
    { new: true },
  );
  return podcast!.totalLikes;
};

export const updateCommentCount = async (podcastId: string): Promise<void> => {
  const [error, podcast] = await to(
    Podcast.findByIdAndUpdate(podcastId, { $inc: { totalComments: 1 } }, { new: true }),
  );
  if (error) console.error(error);
  if (!podcast) console.error("Failed to update podcast comment count");
};

export const updateFavoriteCount = async (podcastId: string, value: number): Promise<void> => {
  const [error, podcast] = await to(
    Podcast.findByIdAndUpdate(podcastId, { $inc: { totalFavorites: value } }, { new: true }),
  );
  if (error) console.error(error);
  if (!podcast) console.error("Failed to update podcast comment count");
};

export const fetchPodcastsSorted = async (sortField: string, limit?: number): Promise<any> => {
  const query = Podcast.find()
    .populate({
      path: "creator",
      select: "user",
      populate: {
        path: "user",
        select: "name",
      },
    })
    .sort({ [sortField]: 1 })
    .lean();

  const [error, podcasts] = await to(query);
  if (error) throw error;
  return podcasts;
};

export const mostCommented = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  const [error, podcasts] = await to(fetchPodcastsSorted("totalComments"));
  if (error) return next(error);
  return res.status(httpStatus.OK).json({ success: true, message: "Success", data: podcasts });
};

export const mostFavorited = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  const [error, podcasts] = await to(fetchPodcastsSorted("totalFavorites"));
  if (error) return next(error);
  return res.status(httpStatus.OK).json({ success: true, message: "Success", data: podcasts });
};

export const mostViewed = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const [error, podcasts] = await to(fetchPodcastsSorted("totalViews"));
  if (error) return next(error);
  return res.status(httpStatus.OK).json({ success: true, message: "Success", data: podcasts });
};

export const mostLiked = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const [error, podcasts] = await to(fetchPodcastsSorted("totalLikes"));
  if (error) return next(error);
  return res.status(httpStatus.OK).json({ success: true, message: "Success", data: podcasts });
};

const popularPodcasts = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  if (page <= 0 || limit <= 0) {
    return next(createError(httpStatus.BAD_REQUEST, "Invalid pagination parameters"));
  }
  let error, podcasts;
  [error, podcasts] = await to(
    Podcast.find()
      .select("title category cover audioDuration totalLikes")
      .populate({
        path: "category",
        select: "title -_id",
      })
      .sort({ totalLikes: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  );
  console.log(podcasts);

  if (error) return next(error);

  if (!podcasts || podcasts.length === 0) {
    return res.status(httpStatus.OK).json({
      success: true,
      message: "No Podcast Found!",
      data: podcasts,
      pagination: {
        page,
        limit,
        total: await Podcast.countDocuments(),
      },
    });
  }
  podcasts = podcasts.map((podcast: any) => ({
    ...podcast,
    audioDuration: (podcast.audioDuration / 60).toFixed(2) + " min",
  }));
  return res.status(httpStatus.OK).json({ success: true, message: "Success", data: podcasts });
};

const latestPodcasts = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  if (page <= 0 || limit <= 0) {
    return next(createError(httpStatus.BAD_REQUEST, "Invalid pagination parameters"));
  }
  let error, podcasts;
  [error, podcasts] = await to(
    Podcast.find()
      .select("title category cover audioDuration createdAt updatedAt")
      .populate({
        path: "category",
        select: "title -_id",
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  );
  if (error) return next(error);

  if (!podcasts || podcasts.length === 0) {
    return res.status(httpStatus.OK).json({
      success: true,
      message: "No Podcast Found!",
      data: podcasts,
      pagination: {
        page,
        limit,
        total: await Podcast.countDocuments(),
      },
    });
  }
  podcasts = podcasts.map((podcast: any) => ({
    ...podcast,
    audioDuration: (podcast.audioDuration / 60).toFixed(2) + " min",
  }));
  return res.status(httpStatus.OK).json({ success: true, message: "Success", data: podcasts });
};

const play = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const user = req.user;
  const id = req.params.id;
  let error,
    podcast,
    like,
    favorite,
    isLiked = false,
    isFavorited = false;
  [error, podcast] = await to(
    Podcast.findById(id)
      .populate({
        path: "creator",
        select: "user -_id donations",
        populate: {
          path: "user",
          select: "name -_id",
        },
      })
      .populate({
        path: "category",
        select: "title",
      })
      .populate({
        path: "subCategory",
        select: "title",
      }),
  );
  if (error) return next(error);
  if (!podcast) return next(createError(httpStatus.NOT_FOUND, "Podcast Not Found"));

  if (podcast.creator) {
    const creator = podcast.creator as any;
    creator.donations = creator.donations ?? null;
  }

  let audioDuration = "";
  if (podcast as PodcastSchema) {
    audioDuration = `${(podcast.audioDuration / 60).toFixed(2)} min`;
  }

  await addPodcast(user.userId, podcast._id!.toString());
  podcast.totalViews += 1;
  await podcast.save();

  [error, like] = await to(Like.findOne({ podcast: id, user: user.userId }));
  if (error) return next(error);
  console.log(isLiked);

  if (like) isLiked = true;
  console.log(like);

  console.log(isLiked);

  [error, favorite] = await to(Favorite.findOne({ user: user.userId, podcasts: id }));
  if (error) return next(error);
  if (favorite) isFavorited = true;

  return res
    .status(httpStatus.OK)
    .json({ success: true, message: "Success", data: { podcast, isLiked, isFavorited } });
};

const playNext = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const user = req.user;
  const id = req.params.id;

  let error, randomPodcast;
  [error, randomPodcast] = await to(
    Podcast.aggregate([
      {
        $match: {
          _id: { $ne: new mongoose.Types.ObjectId(id) },
        },
      },
      { $sample: { size: 1 } },
    ]),
  );
  if (error) return next(error);

  if (!randomPodcast || randomPodcast.length === 0) {
    return res.status(httpStatus.OK).json({
      success: true,
      message: "No Podcast Found",
      data: null,
    });
  }

  [error, randomPodcast] = await to(
    Podcast.findById(randomPodcast[0]._id)
      .populate({
        path: "creator",
        select: "user -_id donations",
        populate: {
          path: "user",
          select: "name -_id",
        },
      })
      .populate({
        path: "category",
        select: "title",
      })
      .populate({
        path: "subCategory",
        select: "title",
      })
      .lean(),
  );
  if (error) return next(error);

  if (randomPodcast!.creator) {
    const creator = randomPodcast!.creator as any;
    creator.donations = creator.donations ?? null;
  }

  if (!randomPodcast) {
    return res.status(httpStatus.NOT_FOUND).json({
      success: false,
      message: "Random Podcast Not Found",
    });
  }

  let isLiked = false,
    isFavorited = false;
  let like, favorite;

  [error, like] = await to(Like.findOne({ podcast: randomPodcast._id, user: user.userId }));
  if (error) return next(error);
  if (like) isLiked = true;

  [error, favorite] = await to(
    Favorite.findOne({ podcasts: randomPodcast._id, user: user.userId }),
  );
  if (error) return next(error);
  if (favorite) isFavorited = true;

  return res.status(httpStatus.OK).json({
    success: true,
    message: "Success",
    data: {
      podcast: randomPodcast,
      isLiked,
      isFavorited,
    },
  });
};

const reportPodcast = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const { podcastId, description } = req.body;
  const user = req.user;
  let error, podcast, creator: any, report;
  [error, podcast] = await to(Podcast.findById(podcastId));
  if (error) return next(error);
  if (!podcast) return next(createError(httpStatus.NOT_FOUND, "Podcast Not Found"));

  [error, creator] = await to(
    Creator.findById(podcast.creator).populate({ path: "user", select: "name" }),
  );
  if (error) return next(error);
  if (!creator) return next(createError(httpStatus.NOT_FOUND, "Creator Not Found"));

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    report = await Report.create({
      podcastId,
      podcastName: podcast.title,
      podcastCover: podcast.cover,
      cretorName: creator.user?.name,
      userName: user.name,
      date: new Date(),
      description,
    });
    await session.commitTransaction();
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    return next(error);
  } finally {
    session.endSession();
  }
  return res.status(httpStatus.OK).json({ success: true, message: "Success", data: report });
};

const PodcastController = {
  create,
  get,
  getAll,
  update,
  remove,
  mostLiked,
  mostCommented,
  mostFavorited,
  mostViewed,
  play,
  playNext,
  latestPodcasts,
  popularPodcasts,
  reportPodcast,
};

export default PodcastController;
