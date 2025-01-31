import { addPodcast } from "@controllers/history";
import Creator from "@models/creator";
import Favorite from "@models/favorite";
import Like from "@models/like";
import Podcast from "@models/podcast";
import Report from "@models/report";
import { PodcastSchema } from "@schemas/podcast";
import to from "await-to-ts";
import { Request, Response, NextFunction } from "express";
import createError from "http-errors";
import mongoose from "mongoose";
import httpStatus from "http-status";

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

const getShortPodcasts = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  if (page <= 0 || limit <= 0) {
    return next(createError(httpStatus.BAD_REQUEST, "Invalid pagination parameters"));
  }

  let error, podcasts;
  [error, podcasts] = await to(
    Podcast.find({ audioDuration: { $lt: 600 } })
      .select("title category cover audioDuration createdAt updatedAt")
      .populate({
        path: "category",
        select: "title -_id",
      })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  );

  if (error) return next(error);

  if (!podcasts || podcasts.length === 0) {
    return res.status(httpStatus.OK).json({
      success: true,
      message: "No short podcasts found!",
      data: podcasts,
      pagination: {
        page,
        limit,
        total: await Podcast.countDocuments({ audioDuration: { $lt: 600 } }),
      },
    });
  }

  podcasts = podcasts.map((podcast: any) => ({
    ...podcast,
    audioDuration: (podcast.audioDuration / 60).toFixed(2) + " min",
  }));

  return res.status(httpStatus.OK).json({
    success: true,
    message: "Success",
    data: podcasts,
    pagination: {
      page,
      limit,
      total: await Podcast.countDocuments({ audioDuration: { $lt: 600 } }),
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
  let isLiked = false,
    isFavorited = false;

  const podcastId = req.params.id;
  if (!podcastId) return next(createError(httpStatus.BAD_REQUEST, "Podcast ID is required"));

  const podcast = await Podcast.findById(podcastId).catch((err) => next(err));
  if (!podcast) return next(createError(httpStatus.NOT_FOUND, "Podcast not found"));

  const { creator, category, subCategory, location } = podcast;

  const fields: Partial<Record<"creator" | "category" | "subCategory" | "location", any>> = {
    creator,
    category,
    subCategory,
    location,
  };

  const findPodcasts = async (query: Record<string, any>, limit: number = 1) => {
    return Podcast.find(query)
      .limit(limit)
      .populate({
        path: "creator",
        select: "user -_id donations",
        populate: { path: "user", select: "name -_id" },
      })
      .populate({ path: "category", select: "title" })
      .populate({ path: "subCategory", select: "title" })
      .lean();
  };

  const queryBase: Record<string, any> = { _id: { $ne: podcastId } };

  for (let i = 4; i >= 0; i--) {
    const query = { ...queryBase };
    if (i > 0) {
      const keys = Object.keys(fields).slice(0, i) as Array<keyof typeof fields>;
      keys.forEach((key) => {
        if (fields[key]) query[key] = fields[key];
      });
    }

    const matchingPodcasts = await findPodcasts(query);
    if (matchingPodcasts.length > 0) {
      const nextPodcast = matchingPodcasts[0];

      if (nextPodcast.creator) {
        const creator = nextPodcast.creator as any;
        creator.donations = creator.donations ?? null;
      }

      await addPodcast(user.userId, nextPodcast._id!.toString());

      nextPodcast.totalViews += 1;
      await Podcast.findByIdAndUpdate(nextPodcast._id, { totalViews: nextPodcast.totalViews });

      const like = await Like.findOne({ podcast: nextPodcast._id, user: user.userId });
      isLiked = !!like;

      const favorite = await Favorite.findOne({ user: user.userId, podcasts: nextPodcast._id });
      isFavorited = !!favorite;

      return res.status(httpStatus.OK).json({
        success: true,
        message: "Success",
        data: { podcast: nextPodcast, isLiked, isFavorited },
      });
    }
  }

  return res.status(httpStatus.OK).json({
    success: true,
    message: "No Podcast Found",
    data: {},
  });
};

const PodcastServices = {
  play,
  playNext,
  latestPodcasts,
  popularPodcasts,
  getShortPodcasts,
  reportPodcast,
};

export default PodcastServices;
