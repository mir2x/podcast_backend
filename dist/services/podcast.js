"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const history_1 = require("../controllers/history");
const creator_1 = __importDefault(require("../models/creator"));
const favorite_1 = __importDefault(require("../models/favorite"));
const like_1 = __importDefault(require("../models/like"));
const podcast_1 = __importDefault(require("../models/podcast"));
const report_1 = __importDefault(require("../models/report"));
const await_to_ts_1 = __importDefault(require("await-to-ts"));
const http_errors_1 = __importDefault(require("http-errors"));
const mongoose_1 = __importDefault(require("mongoose"));
const http_status_1 = __importDefault(require("http-status"));
const popularPodcasts = async (req, res, next) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    if (page <= 0 || limit <= 0) {
        return next((0, http_errors_1.default)(http_status_1.default.BAD_REQUEST, "Invalid pagination parameters"));
    }
    let error, podcasts;
    [error, podcasts] = await (0, await_to_ts_1.default)(podcast_1.default.find()
        .select("title category cover audioDuration totalLikes")
        .populate({
        path: "category",
        select: "title -_id",
    })
        .sort({ totalLikes: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean());
    if (error)
        return next(error);
    if (!podcasts || podcasts.length === 0) {
        return res.status(http_status_1.default.OK).json({
            success: true,
            message: "No Podcast Found!",
            data: podcasts,
            pagination: {
                page,
                limit,
                total: await podcast_1.default.countDocuments(),
            },
        });
    }
    podcasts = podcasts.map((podcast) => ({
        ...podcast,
        audioDuration: (podcast.audioDuration / 60).toFixed(2) + " min",
    }));
    return res.status(http_status_1.default.OK).json({ success: true, message: "Success", data: podcasts });
};
const latestPodcasts = async (req, res, next) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    if (page <= 0 || limit <= 0) {
        return next((0, http_errors_1.default)(http_status_1.default.BAD_REQUEST, "Invalid pagination parameters"));
    }
    let error, podcasts;
    [error, podcasts] = await (0, await_to_ts_1.default)(podcast_1.default.find()
        .select("title category cover audioDuration createdAt updatedAt")
        .populate({
        path: "category",
        select: "title -_id",
    })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean());
    if (error)
        return next(error);
    if (!podcasts || podcasts.length === 0) {
        return res.status(http_status_1.default.OK).json({
            success: true,
            message: "No Podcast Found!",
            data: podcasts,
            pagination: {
                page,
                limit,
                total: await podcast_1.default.countDocuments(),
            },
        });
    }
    podcasts = podcasts.map((podcast) => ({
        ...podcast,
        audioDuration: (podcast.audioDuration / 60).toFixed(2) + " min",
    }));
    return res.status(http_status_1.default.OK).json({ success: true, message: "Success", data: podcasts });
};
const getShortPodcasts = async (req, res, next) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    if (page <= 0 || limit <= 0) {
        return next((0, http_errors_1.default)(http_status_1.default.BAD_REQUEST, "Invalid pagination parameters"));
    }
    let error, podcasts;
    [error, podcasts] = await (0, await_to_ts_1.default)(podcast_1.default.find({ audioDuration: { $lt: 600 } })
        .select("title category cover audioDuration createdAt updatedAt")
        .populate({
        path: "category",
        select: "title -_id",
    })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean());
    if (error)
        return next(error);
    if (!podcasts || podcasts.length === 0) {
        return res.status(http_status_1.default.OK).json({
            success: true,
            message: "No short podcasts found!",
            data: podcasts,
            pagination: {
                page,
                limit,
                total: await podcast_1.default.countDocuments({ audioDuration: { $lt: 600 } }),
            },
        });
    }
    podcasts = podcasts.map((podcast) => ({
        ...podcast,
        audioDuration: (podcast.audioDuration / 60).toFixed(2) + " min",
    }));
    return res.status(http_status_1.default.OK).json({
        success: true,
        message: "Success",
        data: podcasts,
        pagination: {
            page,
            limit,
            total: await podcast_1.default.countDocuments({ audioDuration: { $lt: 600 } }),
        },
    });
};
const reportPodcast = async (req, res, next) => {
    const { podcastId, description } = req.body;
    const user = req.user;
    let error, podcast, creator, report;
    [error, podcast] = await (0, await_to_ts_1.default)(podcast_1.default.findById(podcastId));
    if (error)
        return next(error);
    if (!podcast)
        return next((0, http_errors_1.default)(http_status_1.default.NOT_FOUND, "Podcast Not Found"));
    [error, creator] = await (0, await_to_ts_1.default)(creator_1.default.findById(podcast.creator).populate({ path: "user", select: "name" }));
    if (error)
        return next(error);
    if (!creator)
        return next((0, http_errors_1.default)(http_status_1.default.NOT_FOUND, "Creator Not Found"));
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        report = await report_1.default.create({
            podcastId,
            podcastName: podcast.title,
            podcastCover: podcast.cover,
            cretorName: creator.user?.name,
            userName: user.name,
            date: new Date(),
            description,
        });
        await session.commitTransaction();
    }
    catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        return next(error);
    }
    finally {
        session.endSession();
    }
    return res.status(http_status_1.default.OK).json({ success: true, message: "Success", data: report });
};
const play = async (req, res, next) => {
    const user = req.user;
    const id = req.params.id;
    let error, podcast, like, favorite, isLiked = false, isFavorited = false;
    [error, podcast] = await (0, await_to_ts_1.default)(podcast_1.default.findById(id)
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
    }));
    if (error)
        return next(error);
    if (!podcast)
        return next((0, http_errors_1.default)(http_status_1.default.NOT_FOUND, "Podcast Not Found"));
    if (podcast.creator) {
        const creator = podcast.creator;
        creator.donations = creator.donations ?? null;
    }
    let audioDuration = "";
    if (podcast) {
        audioDuration = `${(podcast.audioDuration / 60).toFixed(2)} min`;
    }
    await (0, history_1.addPodcast)(user.userId, podcast._id.toString());
    podcast.totalViews += 1;
    await podcast.save();
    [error, like] = await (0, await_to_ts_1.default)(like_1.default.findOne({ podcast: id, user: user.userId }));
    if (error)
        return next(error);
    console.log(isLiked);
    if (like)
        isLiked = true;
    console.log(like);
    console.log(isLiked);
    [error, favorite] = await (0, await_to_ts_1.default)(favorite_1.default.findOne({ user: user.userId, podcasts: id }));
    if (error)
        return next(error);
    if (favorite)
        isFavorited = true;
    return res
        .status(http_status_1.default.OK)
        .json({ success: true, message: "Success", data: { podcast, isLiked, isFavorited } });
};
const playNext = async (req, res, next) => {
    const user = req.user;
    let isLiked = false, isFavorited = false;
    const podcastId = req.params.id;
    if (!podcastId)
        return next((0, http_errors_1.default)(http_status_1.default.BAD_REQUEST, "Podcast ID is required"));
    const podcast = await podcast_1.default.findById(podcastId).catch((err) => next(err));
    if (!podcast)
        return next((0, http_errors_1.default)(http_status_1.default.NOT_FOUND, "Podcast not found"));
    const { creator, category, subCategory, location } = podcast;
    const fields = {
        creator,
        category,
        subCategory,
        location,
    };
    const findPodcasts = async (query, limit = 1) => {
        return podcast_1.default.find(query)
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
    const queryBase = { _id: { $ne: podcastId } };
    for (let i = 4; i >= 0; i--) {
        const query = { ...queryBase };
        if (i > 0) {
            const keys = Object.keys(fields).slice(0, i);
            keys.forEach((key) => {
                if (fields[key])
                    query[key] = fields[key];
            });
        }
        const matchingPodcasts = await findPodcasts(query);
        if (matchingPodcasts.length > 0) {
            const nextPodcast = matchingPodcasts[0];
            if (nextPodcast.creator) {
                const creator = nextPodcast.creator;
                creator.donations = creator.donations ?? null;
            }
            await (0, history_1.addPodcast)(user.userId, nextPodcast._id.toString());
            nextPodcast.totalViews += 1;
            await podcast_1.default.findByIdAndUpdate(nextPodcast._id, { totalViews: nextPodcast.totalViews });
            const like = await like_1.default.findOne({ podcast: nextPodcast._id, user: user.userId });
            isLiked = !!like;
            const favorite = await favorite_1.default.findOne({ user: user.userId, podcasts: nextPodcast._id });
            isFavorited = !!favorite;
            return res.status(http_status_1.default.OK).json({
                success: true,
                message: "Success",
                data: { podcast: nextPodcast, isLiked, isFavorited },
            });
        }
    }
    return res.status(http_status_1.default.OK).json({
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
exports.default = PodcastServices;
