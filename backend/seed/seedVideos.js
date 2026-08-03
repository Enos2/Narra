const mongoose = require('mongoose');
const Video = require('../models/Video');
const User = require('../models/User');

const MONGO_URI = 'mongodb://127.0.0.1:27017/narra';

/*
========================================
VIDEOS TO SEED
========================================
*/
const videos = [
  {
    title: 'The Great Adventure',
    description: 'An epic adventure across the mountains.',
    thumbnailUrl: 'https://via.placeholder.com/320x180.png?text=The+Great+Adventure',
    videoUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
    filePath: 'uploads/videos/the-great-adventure.mp4', // <-- required
    creatorEmail: 'alice@example.com',
    type: 'movie',
    genre: ['Adventure'],
    ageRating: 'PG-13',
    isPaid: true,
    price: 10,
    currency: 'USD',
    tags: ['adventure', 'action'],
    approved: true,
  },
  {
    title: 'Invisible Series',
    description: 'Mystery and suspense in every episode.',
    thumbnailUrl: 'https://via.placeholder.com/320x180.png?text=Invisible+Series',
    videoUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
    filePath: 'uploads/videos/invisible-series.mp4', // <-- required
    creatorEmail: 'bob@example.com',
    type: 'series',
    genre: ['Mystery', 'Suspense'],
    ageRating: '18+',
    isPaid: true,
    price: 30,
    currency: 'USD',
    tags: ['mystery', 'series'],
    approved: true,
  },
  {
    title: 'Live Coding Stream',
    description: 'Watch live coding in action.',
    thumbnailUrl: 'https://via.placeholder.com/320x180.png?text=Live+Coding+Stream',
    videoUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
    filePath: 'uploads/videos/live-coding-stream.mp4', // <-- required
    creatorEmail: 'charlie@example.com',
    type: 'live_replay',
    genre: ['Education', 'Coding'],
    ageRating: 'PG',
    isPaid: false,
    price: 0,
    currency: 'USD',
    tags: ['live', 'coding'],
    approved: true,
  },
];

/*
========================================
SEED VIDEOS
========================================
*/
const seedVideos = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected');

    await Video.deleteMany({});
    console.log('Existing videos cleared');

    for (const v of videos) {
      const creator = await User.findOne({ email: v.creatorEmail });

      if (!creator) {
        console.log(`Creator not found for ${v.title}, skipping`);
        continue;
      }

      const videoData = {
        title: v.title,
        description: v.description,
        thumbnailUrl: v.thumbnailUrl,
        videoUrl: v.videoUrl,
        filePath: v.filePath, // <-- added here
        creator: creator._id,
        type: v.type,
        genre: v.genre,
        ageRating: v.ageRating,
        tags: v.tags || [],
        isPaid: v.isPaid,
        price: v.price,
        currency: v.currency,
        approved: v.approved,
        views: 0,
        uniqueViews: 0,
        likes: [],
        dislikes: [],
        ratings: [],
        averageRating: 0,
        isDeleted: false,
        isShadowBanned: false,
        hideEngagement: false,
      };

      await Video.create(videoData);
      console.log(`Video "${v.title}" created`);
    }

    console.log('Video seeding complete');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedVideos();
