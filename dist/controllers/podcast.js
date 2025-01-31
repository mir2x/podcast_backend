"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateFavoriteCount = exports.updateCommentCount = exports.updateLikeCount = void 0;
const await_to_ts_1 = __importDefault(require("await-to-ts"));
const extractMetadata_1 = require("../utils/extractMetadata");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const cloudinary_1 = require("cloudinary");
const podcast_1 = __importDefault(require("../models/podcast"));
const category_1 = __importDefault(require("../models/category"));
const subCategory_1 = __importDefault(require("../models/subCategory"));
const creator_1 = __importDefault(require("../models/creator"));
const mongoose_1 = __importDefault(require("mongoose"));
const http_status_1 = __importDefault(require("http-status"));
const http_errors_1 = __importDefault(require("http-errors"));
const cloudinary_2 = __importDefault(require("../shared/cloudinary"));
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});
const create = async (req, res, next) => {
    const { categoryId, subCategoryId, title, description, location, coverUrl, podcastAudioUrl } = req.body;
    const creatorId = req.user.creatorId;
    let error, category, subCategory;
    [error, category] = await (0, await_to_ts_1.default)(category_1.default.findById(categoryId));
    if (error)
        return next(error);
    if (!category)
        return next((0, http_errors_1.default)(http_status_1.default.NOT_FOUND, "Category Not Found"));
    [error, subCategory] = await (0, await_to_ts_1.default)(subCategory_1.default.findById(subCategoryId));
    if (error)
        return next(error);
    if (!subCategory)
        return next((0, http_errors_1.default)(http_status_1.default.NOT_FOUND, "SubCategory Not Found"));
    const audioMetadata = await (0, extractMetadata_1.getAudioMetadata)(podcastAudioUrl);
    const imageMetadata = await (0, extractMetadata_1.getImageMetadata)(coverUrl);
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    let podcast;
    try {
        podcast = await podcast_1.default.create({
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
        await creator_1.default.findByIdAndUpdate(creatorId, { $push: { podcasts: podcast._id } });
        await subCategory_1.default.findByIdAndUpdate(subCategoryId, { $push: { podcasts: podcast._id } });
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
    return res
        .status(http_status_1.default.CREATED)
        .json({ success: true, message: "Podcast created successfully", data: podcast });
};
const get = async (req, res, next) => {
    const { id } = req.params;
    const [error, podcast] = await (0, await_to_ts_1.default)(podcast_1.default.findById(id)
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
        .lean());
    if (error)
        return next(error);
    if (!podcast)
        return next((0, http_errors_1.default)(http_status_1.default.NOT_FOUND, "Podcast Not Found"));
    return res.status(http_status_1.default.OK).json({ success: true, message: "Success", data: podcast });
};
const getAll = async (req, res, next) => {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;
    if (page <= 0 || limit <= 0) {
        return next((0, http_errors_1.default)(http_status_1.default.BAD_REQUEST, "Invalid pagination parameters"));
    }
    const [error, podcasts] = await (0, await_to_ts_1.default)(podcast_1.default.find()
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
        .lean());
    if (error)
        return next(error);
    if (!podcasts || podcasts.length === 0) {
        return res.status(http_status_1.default.OK).json({
            success: true,
            message: "No Podcast Found!",
            data: [],
            pagination: {
                page,
                limit,
                total: await podcast_1.default.countDocuments(),
            },
        });
    }
    const formattedPodcasts = podcasts.map((podcast) => ({
        ...podcast,
        audioDuration: (podcast.audioDuration / 60).toFixed(2) + " min",
    }));
    return res.status(http_status_1.default.OK).json({
        success: true,
        message: "Success",
        data: formattedPodcasts,
        pagination: {
            page,
            limit,
            total: await podcast_1.default.countDocuments(),
        },
    });
};
const getShortPodcasts = async (req, res, next) => {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;
    if (page <= 0 || limit <= 0) {
        return next((0, http_errors_1.default)(http_status_1.default.BAD_REQUEST, "Invalid pagination parameters"));
    }
    const [error, podcasts] = await (0, await_to_ts_1.default)(podcast_1.default.find({ audioDuration: { $lt: 600 } }) // Filtering podcasts less than 10 minutes (600 seconds)
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
        .lean());
    if (error)
        return next(error);
    if (!podcasts || podcasts.length === 0) {
        return res.status(http_status_1.default.OK).json({
            success: true,
            message: "No short podcasts found!",
            data: [],
            pagination: {
                page,
                limit,
                total: await podcast_1.default.countDocuments({ audioDuration: { $lt: 600 } }),
            },
        });
    }
    const formattedPodcasts = podcasts.map((podcast) => ({
        ...podcast,
        audioDuration: (podcast.audioDuration / 60).toFixed(2) + " min",
    }));
    return res.status(http_status_1.default.OK).json({
        success: true,
        message: "Success",
        data: formattedPodcasts,
        pagination: {
            page,
            limit,
            total: await podcast_1.default.countDocuments({ audioDuration: { $lt: 600 } }),
        },
    });
};
const update = async (req, res, next) => {
    const { categoryId, subCategoryId, title, description, location, coverUrl, podcastAudioUrl } = req.body;
    let error, podcast;
    const id = req.params.id;
    [error, podcast] = await (0, await_to_ts_1.default)(podcast_1.default.findById(id));
    if (error)
        return next(error);
    if (!podcast)
        return next((0, http_errors_1.default)(http_status_1.default.NOT_FOUND, "Podcast Not found"));
    if (categoryId) {
        let category;
        [error, category] = await (0, await_to_ts_1.default)(category_1.default.findById(categoryId));
        if (error)
            return next(error);
        if (!category)
            return next((0, http_errors_1.default)(http_status_1.default.NOT_FOUND, "Category not found!"));
        podcast.category = categoryId;
    }
    if (subCategoryId) {
        let subCategory;
        [error, subCategory] = await (0, await_to_ts_1.default)(subCategory_1.default.findById(subCategoryId));
        if (error)
            return next(error);
        if (!subCategory)
            return next((0, http_errors_1.default)(http_status_1.default.NOT_FOUND, "subCategory not found!"));
        podcast.subCategory = subCategoryId;
    }
    podcast.title = title || podcast.title;
    podcast.description = description || podcast.description;
    podcast.location = location || podcast.location;
    if (coverUrl) {
        await cloudinary_2.default.remove(podcast.cover);
        podcast.cover = coverUrl;
    }
    if (podcastAudioUrl) {
        await cloudinary_2.default.remove(podcast.audio);
        podcast.audio = podcastAudioUrl;
    }
    [error] = await (0, await_to_ts_1.default)(podcast.save());
    if (error)
        return next(error);
    res.status(http_status_1.default.OK).json({ success: true, message: "Success", data: podcast });
};
const remove = async (req, res, next) => {
    let error, podcast;
    const { id } = req.params;
    [error, podcast] = await (0, await_to_ts_1.default)(podcast_1.default.findById(id));
    if (error)
        return next(error);
    if (!podcast)
        return res.status(400).json({ error: "Podcast Not Found" });
    const session = await mongoose_1.default.startSession();
    try {
        session.startTransaction();
        if (podcast.audio) {
            const audioPublicId = getCloudinaryPublicId(podcast.audio);
            console.log(audioPublicId);
            await cloudinary_1.v2.uploader.destroy(audioPublicId, {
                resource_type: "video",
            });
        }
        if (podcast.cover) {
            const coverPath = path_1.default.resolve(podcast.cover);
            fs_1.default.unlink(coverPath, (err) => {
                if (err) {
                    console.error("Failed to delete cover file locally:", err);
                }
            });
        }
        await creator_1.default.findByIdAndUpdate(podcast.creator, { $pull: { podcasts: id } });
        await subCategory_1.default.findByIdAndUpdate(podcast.subCategory, { $pull: { podcasts: id } });
        await podcast_1.default.findByIdAndDelete(id);
        await session.commitTransaction();
        session.endSession();
    }
    catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
            session.endSession();
        }
        return next(error);
    }
    res.status(http_status_1.default.OK).json({ success: true, message: "Podcast deleted successfully" });
};
const getCloudinaryPublicId = (url) => {
    const parts = url.split("/");
    const filenameWithExt = parts[parts.length - 1];
    const [filename] = filenameWithExt.split(".");
    return parts
        .slice(parts.length - 2, parts.length - 1)
        .concat(filename)
        .join("/");
};
const updateLikeCount = async (podcastId, value) => {
    const podcast = await podcast_1.default.findByIdAndUpdate(podcastId, { $inc: { totalLikes: value } }, { new: true });
    return podcast.totalLikes;
};
exports.updateLikeCount = updateLikeCount;
const updateCommentCount = async (podcastId) => {
    const [error, podcast] = await (0, await_to_ts_1.default)(podcast_1.default.findByIdAndUpdate(podcastId, { $inc: { totalComments: 1 } }, { new: true }));
    if (error)
        console.error(error);
    if (!podcast)
        console.error("Failed to update podcast comment count");
};
exports.updateCommentCount = updateCommentCount;
const updateFavoriteCount = async (podcastId, value) => {
    const [error, podcast] = await (0, await_to_ts_1.default)(podcast_1.default.findByIdAndUpdate(podcastId, { $inc: { totalFavorites: value } }, { new: true }));
    if (error)
        console.error(error);
    if (!podcast)
        console.error("Failed to update podcast comment count");
};
exports.updateFavoriteCount = updateFavoriteCount;
const PodcastController = {
    create,
    get,
    getAll,
    getShortPodcasts,
    update,
    remove,
};
exports.default = PodcastController;
