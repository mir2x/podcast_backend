"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const category_1 = __importDefault(require("../models/category"));
const http_status_1 = __importDefault(require("http-status"));
const podcast_1 = __importDefault(require("../models/podcast"));
const admin_1 = __importDefault(require("../models/admin"));
const mongoose_1 = require("mongoose");
const homeController = async (req, res, next) => {
    try {
        const location = req.user.locationPreference || null;
        const defaultAvatar = "uploads/default/default-avatar.png";
        const formatAudioDuration = (duration) => `${(duration / 60).toFixed(2)} min`;
        /* Categories */
        const categoriesPromise = category_1.default.find().select("title categoryImage").limit(4).lean();
        /* Admin */
        const adminAccount = await admin_1.default.findOne().lean();
        const creatorId = adminAccount?.creator || new mongoose_1.Types.ObjectId(process.env.CREATORID);
        const adminPromise = podcast_1.default.aggregate([
            { $match: { creator: creatorId } },
            { $sort: { totalLikes: -1 } },
            { $limit: 1 },
            {
                $lookup: {
                    from: "creators",
                    localField: "creator",
                    foreignField: "_id",
                    as: "creatorDetails",
                },
            },
            { $unwind: "$creatorDetails" },
            {
                $lookup: {
                    from: "users",
                    localField: "creatorDetails.user",
                    foreignField: "_id",
                    as: "userDetails",
                },
            },
            { $unwind: "$userDetails" },
            {
                $project: {
                    _id: 0,
                    name: "$userDetails.name",
                    avatar: { $ifNull: ["$userDetails.avatar", defaultAvatar] },
                    podcast: "$_id",
                },
            },
        ]);
        /* Creators */
        const creatorsPromise = podcast_1.default.aggregate([
            { $match: { creator: { $ne: creatorId } } },
            {
                $group: {
                    _id: "$creator",
                    totalLikes: { $max: "$totalLikes" },
                    podcast: { $first: "$_id" },
                    title: { $first: "$title" },
                    description: { $first: "$description" },
                },
            },
            { $sort: { totalLikes: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: "creators",
                    localField: "_id",
                    foreignField: "_id",
                    as: "creatorDetails",
                },
            },
            { $unwind: "$creatorDetails" },
            {
                $lookup: {
                    from: "users",
                    localField: "creatorDetails.user",
                    foreignField: "_id",
                    as: "userDetails",
                },
            },
            { $unwind: "$userDetails" },
            {
                $project: {
                    _id: 0,
                    name: "$userDetails.name",
                    avatar: { $ifNull: ["$userDetails.avatar", defaultAvatar] },
                    podcast: 1,
                },
            },
        ]);
        /* Podcasts */
        const fetchPodcasts = async (sortField, limit, locationFilter, filter) => {
            const query = { ...filter, ...(locationFilter && location ? { location } : {}) };
            const podcasts = await podcast_1.default.find(query)
                .select("title category cover audioDuration")
                .populate({
                path: "category",
                select: "title -_id",
            })
                .sort({ [sortField]: -1 })
                .limit(limit)
                .lean();
            if (locationFilter && podcasts.length === 0 && location) {
                return podcast_1.default.find(filter || {})
                    .select("title category cover audioDuration")
                    .populate({
                    path: "category",
                    select: "title -_id",
                })
                    .sort({ [sortField]: -1 })
                    .limit(limit)
                    .lean();
            }
            return podcasts;
        };
        const newPodcastsPromise = fetchPodcasts("createdAt", 2, true);
        const popularPodcastsPromise = fetchPodcasts("totalLikes", 3, true);
        const shortPodcastsPromise = fetchPodcasts("createdAt", 4, false, {
            audioDuration: { $lt: 600 },
        });
        const [categories, admin, creators, newPodcasts, popularPodcasts, shortPodcasts] = await Promise.all([
            categoriesPromise,
            adminPromise,
            creatorsPromise,
            newPodcastsPromise,
            popularPodcastsPromise,
            shortPodcastsPromise,
        ]);
        const formatPodcasts = (podcasts) => podcasts.map((podcast) => ({
            ...podcast,
            audioDuration: formatAudioDuration(podcast.audioDuration),
        }));
        return res.status(http_status_1.default.OK).json({
            success: true,
            message: "Success",
            data: {
                location,
                categories,
                admin: admin[0] || null,
                creators,
                newPodcasts: formatPodcasts(newPodcasts),
                popularPodcasts: formatPodcasts(popularPodcasts),
                shortPodcasts: formatPodcasts(shortPodcasts),
            },
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.default = homeController;
