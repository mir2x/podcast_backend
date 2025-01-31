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
import Cloudinary from "@shared/cloudinary";

type PodcastFiles = Express.Request & {
  files: { [fieldname: string]: Express.Multer.File[] };
};

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const create = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const { categoryId, subCategoryId, title, description, location, coverUrl, podcastAudioUrl } =
    req.body;
  const creatorId = req.user.creatorId;

  let error, category, subCategory;

  [error, category] = await to(Category.findById(categoryId));
  if (error) return next(error);
  if (!category) return next(createError(httpStatus.NOT_FOUND, "Category Not Found"));

  [error, subCategory] = await to(SubCategory.findById(subCategoryId));
  if (error) return next(error);
  if (!subCategory) return next(createError(httpStatus.NOT_FOUND, "SubCategory Not Found"));

  const audioMetadata = await getAudioMetadata(podcastAudioUrl);
  const imageMetadata = await getImageMetadata(coverUrl);

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
      cover: coverUrl,
      coverFormat: imageMetadata.format,
      coverSize: imageMetadata.size,
      audio: podcastAudioUrl,
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
      total: await Podcast.countDocuments(),
    },
  });
};

const getShortPodcasts = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.max(Number(req.query.limit) || 10, 1);
  const skip = (page - 1) * limit;

  if (page <= 0 || limit <= 0) {
    return next(createError(httpStatus.BAD_REQUEST, "Invalid pagination parameters"));
  }

  const [error, podcasts] = await to(
    Podcast.find({ audioDuration: { $lt: 600 } }) // Filtering podcasts less than 10 minutes (600 seconds)
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
      message: "No short podcasts found!",
      data: [],
      pagination: {
        page,
        limit,
        total: await Podcast.countDocuments({ audioDuration: { $lt: 600 } }),
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
      total: await Podcast.countDocuments({ audioDuration: { $lt: 600 } }),
    },
  });
};

const update = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const { categoryId, subCategoryId, title, description, location, coverUrl, podcastAudioUrl } =
    req.body;
  let error, podcast;
  const id = req.params.id;

  [error, podcast] = await to(Podcast.findById(id));
  if (error) return next(error);
  if (!podcast) return next(createError(httpStatus.NOT_FOUND, "Podcast Not found"));

  if (categoryId) {
    let category;
    [error, category] = await to(Category.findById(categoryId));
    if (error) return next(error);
    if (!category) return next(createError(httpStatus.NOT_FOUND, "Category not found!"));
    podcast.category = categoryId;
  }
  if (subCategoryId) {
    let subCategory;
    [error, subCategory] = await to(SubCategory.findById(subCategoryId));
    if (error) return next(error);
    if (!subCategory) return next(createError(httpStatus.NOT_FOUND, "subCategory not found!"));
    podcast.subCategory = subCategoryId;
  }
  podcast.title = title || podcast.title;
  podcast.description = description || podcast.description;
  podcast.location = location || podcast.location;

  if (coverUrl) {
    await Cloudinary.remove(podcast.cover!);
    podcast.cover = coverUrl;
  }

  if (podcastAudioUrl) {
    await Cloudinary.remove(podcast.audio);
    podcast.audio = podcastAudioUrl;
  }

  [error] = await to(podcast.save());
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

const PodcastController = {
  create,
  get,
  getAll,
  getShortPodcasts,
  update,
  remove,
};

export default PodcastController;
