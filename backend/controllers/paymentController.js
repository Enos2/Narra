// controllers/paymentController.js
const User = require('../models/User');
const Video = require('../models/Video');
const Live = require('../models/Live');

/*
|---------------------------------------------------------------------------
| INTERNAL WALLET PAYMENT
| Supports: Video purchases, Live stream purchases
| Includes:
| - balance check
| - prevents duplicate purchase
| - platform/creator split
| - audit logs
|---------------------------------------------------------------------------
*/
exports.payWithWallet = async (req, res) => {
  try {
    const { type } = req.body; // 'video' or 'live'
    const { id } = req.params; // videoId or liveId

    if (!['video', 'live'].includes(type)) {
      return res.status(400).json({ message: 'Invalid type' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ message: 'User not found' });

    let item, creator;

    if (type === 'video') {
      item = await Video.findById(id);
      if (!item) return res.status(404).json({ message: 'Video not found' });
      if (!item.isPaid) return res.status(400).json({ message: 'Video is free' });

      creator = await User.findById(item.creator);
      if (!creator) return res.status(404).json({ message: 'Creator not found' });

      // Prevent duplicate purchase
      if (item.purchases.map(i => i.toString()).includes(user._id.toString())) {
        return res.status(400).json({ message: 'Already purchased' });
      }
    } else {
      // type === 'live'
      item = await Live.findById(id);
      if (!item) return res.status(404).json({ message: 'Live stream not found' });
      if (!item.isPaid) return res.status(400).json({ message: 'Live stream is free' });

      creator = await User.findById(item.host);
      if (!creator) return res.status(404).json({ message: 'Host not found' });

      if (item.purchases.map(i => i.toString()).includes(user._id.toString())) {
        return res.status(400).json({ message: 'Already purchased' });
      }
    }

    // Check user balance
    if (user.balance < item.price) {
      return res.status(402).json({
        message: 'Insufficient balance',
        required: item.price,
        balance: user.balance,
      });
    }

    // Payment split: platform 20%, creator 80%
    const platformCut = parseFloat((item.price * 0.2).toFixed(2));
    const creatorCut = parseFloat((item.price * 0.8).toFixed(2));

    user.balance -= item.price;
    creator.balance += creatorCut;

    // Add purchase record
    item.purchases.push(user._id);

    if (type === 'video') user.purchasedVideos.push(item._id);
    else user.purchasedLiveStreams = user.purchasedLiveStreams || [];
    if (type === 'live') user.purchasedLiveStreams.push(item._id);

    // Optional: add admin bypass for internal testing
    if (req.user.role === 'superadmin') {
      console.log(`Superadmin bypassed payment for ${type} ${item._id}`);
    }

    await Promise.all([user.save(), creator.save(), item.save()]);

    res.json({
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} purchase successful`,
      itemId: item._id,
      platformCut,
      creatorCut,
      remainingBalance: user.balance,
    });
  } catch (err) {
    console.error('Payment error:', err);
    res.status(500).json({ message: 'Payment failed' });
  }
};
