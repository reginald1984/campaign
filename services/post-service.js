const Post = require('../models/Post');
const Subscribe = require('../models/Subscribe');
const HttpError = require('../middleware/HttpError');
const { emailService } = require('./email-service');
const {cloudinary} = require('../config/cloudinary');
const fs = require('fs');

// Helper function to generate slug
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim();
};

// Helper function to make slug unique
const makeSlugUnique = async (baseSlug, excludeId = null) => {
  let slug = baseSlug;
  let counter = 1;
  let exists = true;
  
  while (exists) {
    const query = { slug };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const existingPost = await Post.findOne(query);
    if (!existingPost) {
      exists = false;
    } else {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }
  
  return slug;
};

class PostService {
  /**
   * Create a new post
   */
async createPost(postData, authorId, featuredImageFile = null) {
  try {
    const { title, content, category, status, scheduledFor, tags, seoTitle, seoDescription, callToAction } = postData;

    // Validate required fields
    if (!title || !content) {
      throw new HttpError('Title and content are required', 400);
    }

    // Generate slug from title
    let slug = generateSlug(title);
    slug = await makeSlugUnique(slug);

    // Generate excerpt if not provided
    let excerpt = postData.excerpt;
    if (!excerpt && content) {
      excerpt = content.replace(/<[^>]*>/g, '').substring(0, 300);
      if (excerpt.length === 300) excerpt += '...';
    }

    // Create post object
    const post = new Post({
      title,
      slug,
      content,
      excerpt,
      author: authorId,
      category: category || 'campaign_update',
      status: status || 'draft',
      scheduledFor: scheduledFor || null,
      tags: tags || [],
      seoTitle: seoTitle || title.substring(0, 70),
      seoDescription: seoDescription || excerpt?.substring(0, 160),
      callToAction: callToAction || { text: '', url: '', type: 'learn_more' }
    });

    // Handle featured image if provided
    if (featuredImageFile) {
      try {
        let imageUrl, publicId;
        
        // Check if it's a file buffer or a Cloudinary URL
        if (featuredImageFile.buffer) {
          // Upload buffer to Cloudinary
          const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream({
              folder: 'campaign/posts/featured',
              width: 1200,
              height: 630,
              crop: 'fill',
              quality: 'auto'
            }, (error, result) => {
              if (error) reject(error);
              else resolve(result);
            });
            
            // Convert buffer to stream
            const Readable = require('stream').Readable;
            const readableStream = new Readable();
            readableStream.push(featuredImageFile.buffer);
            readableStream.push(null);
            readableStream.pipe(uploadStream);
          });
          
          imageUrl = result.secure_url;
          publicId = result.public_id;
        } else if (featuredImageFile.path) {
          // Upload local file to Cloudinary
          const result = await cloudinary.uploader.upload(featuredImageFile.path, {
            folder: 'campaign/posts/featured',
            width: 1200,
            height: 630,
            crop: 'fill',
            quality: 'auto'
          });
          imageUrl = result.secure_url;
          publicId = result.public_id;
          
          // Remove temporary file
          if (fs.existsSync(featuredImageFile.path)) {
            fs.unlinkSync(featuredImageFile.path);
          }
        } else if (typeof featuredImageFile === 'string') {
          // If it's a string URL, use it directly
          imageUrl = featuredImageFile;
          publicId = null;
        } else {
          throw new Error('Invalid featured image format');
        }
        
        post.featuredImage = {
          url: imageUrl,
          publicId: publicId,
          caption: excerpt || '',
          alt: title,
          cloudinaryUrl: imageUrl,
          width: 1200,
          height: 630
        };
      } catch (uploadError) {
        console.error('Failed to upload featured image:', uploadError);
        // Continue without featured image if upload fails
      }
    }

    await post.save();

    // If status is published immediately, update publishedAt
    if (post.status === 'published') {
      post.publishedAt = new Date();
      await post.save();
      
      // Send notifications to subscribers
      await this.sendNewPostNotifications(post);
    }

    return {
      success: true,
      message: 'Post created successfully',
      data: post
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError('Failed to create post: ' + error.message, 500);
  }
}

  /**
   * Update a post
   */
  async updatePost(postId, updateData, authorId) {
    try {
      const post = await Post.findById(postId);
      
      if (!post) {
        throw new HttpError('Post not found', 404);
      }

      // If title is being updated, generate new slug
      if (updateData.title && updateData.title !== post.title) {
        let slug = generateSlug(updateData.title);
        slug = await makeSlugUnique(slug, postId);
        updateData.slug = slug;
      }

      // Update fields
      Object.keys(updateData).forEach(key => {
        if (key !== '_id' && key !== '__v' && key !== 'createdAt') {
          post[key] = updateData[key];
        }
      });

      // Update publishedAt if status changed to published
      if (updateData.status === 'published' && post.status !== 'published') {
        post.publishedAt = new Date();
        await post.save();
        
        // Send notifications to subscribers for new published post
        await this.sendNewPostNotifications(post);
      }

      await post.save();

      return {
        success: true,
        message: 'Post updated successfully',
        data: post
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to update post: ' + error.message, 500);
    }
  }

  /**
   * Get post by slug (public view)
   */
  async getPostBySlug(slug) {
    try {
      const post = await Post.findOne({ 
        slug, 
        status: 'published',
        $or: [
          { scheduledFor: { $lte: new Date() } },
          { scheduledFor: null }
        ]
      }).populate('author', 'name profilePicture.url position');
      
      if (!post) {
        throw new HttpError('Post not found', 404);
      }

      // Increment view count
      await post.incrementViews();

      return {
        success: true,
        data: post
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to fetch post', 500);
    }
  }

  /**
   * Get post by ID (admin view - can see drafts)
   */
  async getPostById(postId) {
    try {
      const post = await Post.findById(postId).populate('author', 'name email');
      
      if (!post) {
        throw new HttpError('Post not found', 404);
      }

      return {
        success: true,
        data: post
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to fetch post', 500);
    }
  }

  /**
   * Get all published posts with pagination
   */
  async getPublishedPosts(page = 1, limit = 10, category = null, tag = null) {
    try {
      const skip = (page - 1) * limit;
      let filter = { 
        status: 'published',
        $or: [
          { scheduledFor: { $lte: new Date() } },
          { scheduledFor: null }
        ]
      };

      if (category && category !== 'all') {
        filter.category = category;
      }

      if (tag) {
        filter.tags = tag;
      }

      const posts = await Post.find(filter)
        .populate('author', 'name profilePicture.url position')
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-content'); // Exclude full content for list view

      const total = await Post.countDocuments(filter);

      return {
        success: true,
        data: posts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new HttpError('Failed to fetch posts', 500);
    }
  }

  /**
   * Get all posts for admin (including drafts)
   */
  async getAllPostsForAdmin(page = 1, limit = 20, status = null) {
    try {
      const skip = (page - 1) * limit;
      let filter = {};
      
      if (status && status !== 'all') {
        filter.status = status;
      }

      const posts = await Post.find(filter)
        .populate('author', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Post.countDocuments(filter);

      return {
        success: true,
        data: posts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new HttpError('Failed to fetch posts', 500);
    }
  }

  /**
   * Get featured posts
   */
  async getFeaturedPosts(limit = 5) {
    try {
      const posts = await Post.find({ 
        isFeatured: true,
        status: 'published',
        $or: [
          { scheduledFor: { $lte: new Date() } },
          { scheduledFor: null }
        ]
      })
      .populate('author', 'name profilePicture.url position')
      .sort({ priority: -1, publishedAt: -1 })
      .limit(limit);

      return {
        success: true,
        data: posts
      };
    } catch (error) {
      throw new HttpError('Failed to fetch featured posts', 500);
    }
  }

  /**
   * Search posts
   */
  async searchPosts(query, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      
      const posts = await Post.find(
        { 
          $text: { $search: query },
          status: 'published',
          $or: [
            { scheduledFor: { $lte: new Date() } },
            { scheduledFor: null }
          ]
        },
        { score: { $meta: 'textScore' } }
      )
      .populate('author', 'name profilePicture.url position')
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limit);

      const total = await Post.countDocuments({ 
        $text: { $search: query },
        status: 'published'
      });

      return {
        success: true,
        data: posts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        query
      };
    } catch (error) {
      throw new HttpError('Failed to search posts', 500);
    }
  }

  /**
   * Get posts by category
   */
  async getPostsByCategory(category, page = 1, limit = 10) {
    return await this.getPublishedPosts(page, limit, category);
  }

  /**
   * Get posts by tag
   */
  async getPostsByTag(tag, page = 1, limit = 10) {
    return await this.getPublishedPosts(page, limit, null, tag);
  }

  /**
   * Delete a post
   */
  async deletePost(postId) {
    try {
      const post = await Post.findById(postId);
      
      if (!post) {
        throw new HttpError('Post not found', 404);
      }

      // Delete featured image from Cloudinary if exists
      if (post.featuredImage && post.featuredImage.publicId) {
        await cloudinary.uploader.destroy(post.featuredImage.publicId);
      }

      // Delete gallery images from Cloudinary
      if (post.gallery && post.gallery.length > 0) {
        for (const image of post.gallery) {
          if (image.publicId) {
            await cloudinary.uploader.destroy(image.publicId);
          }
        }
      }

      await post.deleteOne();

      return {
        success: true,
        message: 'Post deleted successfully'
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to delete post', 500);
    }
  }

  /**
   * Upload featured image
   */
async uploadFeaturedImage(postId, filePath, alt = '', caption = '') {
  try {
    console.log('=== Starting featured image upload ===');
    console.log('Post ID:', postId);
    console.log('File path:', filePath);
    
    // Check if file exists
    if (!filePath) {
      console.error('No file path provided');
      throw new HttpError('No file provided', 400);
    }
    
    if (!fs.existsSync(filePath)) {
      console.error(`File does not exist at path: ${filePath}`);
      throw new HttpError('File not found on server', 400);
    }
    
    console.log('File exists, size:', fs.statSync(filePath).size, 'bytes');
    
    const post = await Post.findById(postId);
    
    if (!post) {
      console.error(`Post not found: ${postId}`);
      throw new HttpError('Post not found', 404);
    }
    
    // Delete old featured image from Cloudinary if exists
    if (post.featuredImage && post.featuredImage.publicId) {
      console.log('Deleting old featured image:', post.featuredImage.publicId);
      try {
        await cloudinary.uploader.destroy(post.featuredImage.publicId);
        console.log('Old featured image deleted successfully');
      } catch (deleteError) {
        console.warn('Failed to delete old featured image:', deleteError.message);
      }
    }
    
    // Upload new image to Cloudinary
    console.log('Uploading to Cloudinary...');
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'campaign/posts/featured',
      width: 1200,
      height: 630,
      crop: 'fill',
      quality: 'auto'
    });
    
    console.log('Cloudinary upload successful:', {
      public_id: result.public_id,
      url: result.secure_url
    });
    
    // Update post with new featured image
    post.featuredImage = {
      url: result.secure_url,
      publicId: result.public_id,
      alt: alt || post.title,
      caption: caption || post.excerpt || '',
      cloudinaryUrl: result.secure_url,
      width: 1200,
      height: 630,
      format: result.format
    };
    
    await post.save();
    console.log('Post updated successfully');
    
    // Remove temporary file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('Temporary file removed:', filePath);
    }
    
    console.log('=== Featured image upload completed ===');
    
    return {
      success: true,
      message: 'Featured image uploaded successfully',
      data: post.featuredImage
    };
  } catch (error) {
    console.error('=== Featured image upload failed ===');
    console.error('Error:', error);
    
    // Clean up temp file if it exists
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log('Cleaned up temp file:', filePath);
      } catch (cleanupError) {
        console.error('Failed to clean up temp file:', cleanupError);
      }
    }
    
    if (error instanceof HttpError) throw error;
    throw new HttpError('Failed to upload featured image: ' + error.message, 500);
  }
}

  /**
   * Upload gallery images
   */
  async uploadGalleryImages(postId, files) {
    try {
      const post = await Post.findById(postId);
      
      if (!post) {
        throw new HttpError('Post not found', 404);
      }

      const uploadedImages = [];

      for (const file of files) {
        let imageUrl, publicId;
        
        // Check if file is from multer-storage-cloudinary or local
        if (file.path && file.path.includes('cloudinary')) {
          // Already uploaded to Cloudinary by multer-storage-cloudinary
          imageUrl = file.path;
          publicId = file.filename;
        } else if (file.path) {
          // Local file - upload to Cloudinary
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'campaign/posts/gallery',
            quality: 'auto'
          });
          imageUrl = result.secure_url;
          publicId = result.public_id;
          
          // Remove temporary file
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } else {
          continue; // Skip invalid files
        }

        uploadedImages.push({
          url: imageUrl,
          publicId: publicId,
          caption: '',
          cloudinaryUrl: imageUrl
        });
      }

      post.gallery.push(...uploadedImages);
      await post.save();

      return {
        success: true,
        message: `${uploadedImages.length} images uploaded successfully`,
        data: post.gallery
      };
    } catch (error) {
      // Clean up temp files
      if (files) {
        files.forEach(file => {
          if (file && file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
      throw new HttpError('Failed to upload gallery images: ' + error.message, 500);
    }
  }

  /**
   * Remove gallery image
   */
  async removeGalleryImage(postId, imagePublicId) {
    try {
      const post = await Post.findById(postId);
      
      if (!post) {
        throw new HttpError('Post not found', 404);
      }

      // Delete from Cloudinary
      await cloudinary.uploader.destroy(imagePublicId);

      // Remove from post
      post.gallery = post.gallery.filter(img => img.publicId !== imagePublicId);
      await post.save();

      return {
        success: true,
        message: 'Image removed successfully'
      };
    } catch (error) {
      throw new HttpError('Failed to remove image', 500);
    }
  }

  /**
   * Send notifications to subscribers when new post is published
   */
  async sendNewPostNotifications(post) {
    try {
      // Get all active subscribers for this post's category/tags
      const subscribers = await Subscribe.find({ 
        isActive: true,
        postId: post._id
      });

      if (subscribers.length === 0) {
        return;
      }

      // Prepare post data for email
      const postData = {
        _id: post._id,
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        createdAt: post.publishedAt,
        category: post.category,
        featuredImage: post.featuredImage?.url
      };

      // Send emails in batches
      const batchSize = 50;
      for (let i = 0; i < subscribers.length; i += batchSize) {
        const batch = subscribers.slice(i, i + batchSize);
        
        for (const subscriber of batch) {
          const unsubscribeUrl = `${process.env.CLIENT_URL}/unsubscribe?email=${encodeURIComponent(subscriber.email)}&postId=${post._id}`;
          
          await emailService.sendNewPostNotification(
            subscriber.email,
            postData,
            unsubscribeUrl
          );
        }

        // Rate limiting between batches
        if (i + batchSize < subscribers.length) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      // Update last notified date
      await Subscribe.updateMany(
        { postId: post._id, isActive: true },
        { 
          lastNotifiedAt: new Date(),
          $inc: { notificationCount: 1 }
        }
      );

      console.log(`Sent notifications to ${subscribers.length} subscribers for post: ${post.title}`);
    } catch (error) {
      console.error('Failed to send post notifications:', error);
    }
  }

  /**
   * Get post statistics for admin dashboard
   */
  async getPostStats() {
    try {
      const total = await Post.countDocuments();
      const published = await Post.countDocuments({ status: 'published' });
      const drafts = await Post.countDocuments({ status: 'draft' });
      const scheduled = await Post.countDocuments({ status: 'scheduled' });
      const archived = await Post.countDocuments({ status: 'archived' });
      
      const totalViews = await Post.aggregate([
        { $group: { _id: null, total: { $sum: '$viewCount' } } }
      ]);

      const categoryStats = await Post.aggregate([
        { $match: { status: 'published' } },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]);

      return {
        success: true,
        data: {
          total,
          published,
          drafts,
          scheduled,
          archived,
          totalViews: totalViews[0]?.total || 0,
          categoryStats
        }
      };
    } catch (error) {
      throw new HttpError('Failed to fetch post statistics', 500);
    }
  }

  /**
   * Get related posts
   */
  async getRelatedPosts(postId, limit = 3) {
    try {
      const post = await Post.findById(postId);
      
      if (!post) {
        throw new HttpError('Post not found', 404);
      }

      const relatedPosts = await Post.find({
        _id: { $ne: postId },
        status: 'published',
        $or: [
          { category: post.category },
          { tags: { $in: post.tags } }
        ]
      })
      .populate('author', 'name profilePicture.url position')
      .sort({ publishedAt: -1 })
      .limit(limit)
      .select('-content');

      return {
        success: true,
        data: relatedPosts
      };
    } catch (error) {
      throw new HttpError('Failed to fetch related posts', 500);
    }
  }

  /**
 * Like a post
 */
async likePost(postId, userId = null) {
  try {
    const post = await Post.findById(postId);
    
    if (!post) {
      throw new HttpError('Post not found', 404);
    }

    // Check if post is published (only published posts can be liked)
    if (post.status !== 'published') {
      throw new HttpError('Cannot like unpublished posts', 400);
    }

    // Check if scheduled post is not yet published
    if (post.scheduledFor && post.scheduledFor > new Date()) {
      throw new HttpError('Cannot like scheduled posts that are not yet published', 400);
    }

    // Initialize likes array if it doesn't exist
    if (!post.likes) {
      post.likes = [];
    }

    let isLiked = false;
    let message = '';

    // If userId is provided (authenticated user)
    if (userId) {
      const userLikeIndex = post.likes.findIndex(
        like => like.user && like.user.toString() === userId.toString()
      );

      if (userLikeIndex === -1) {
        // Add like
        post.likes.push({
          user: userId,
          likedAt: new Date()
        });
        post.likeCount += 1;
        isLiked = true;
        message = 'Post liked successfully';
      } else {
        // Remove like (unlike)
        post.likes.splice(userLikeIndex, 1);
        post.likeCount -= 1;
        isLiked = false;
        message = 'Post unliked successfully';
      }
    } else {
      // For anonymous users, just track by IP or session (simple count)
      // You might want to implement a more sophisticated tracking system
      post.likeCount += 1;
      isLiked = true;
      message = 'Post liked successfully';
    }

    await post.save();

    return {
      success: true,
      message: message,
      data: {
        likeCount: post.likeCount,
        isLiked: isLiked
      }
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError('Failed to like/unlike post: ' + error.message, 500);
  }
}

/**
 * Get like status for a post
 */
async getLikeStatus(postId, userId = null) {
  try {
    const post = await Post.findById(postId);
    
    if (!post) {
      throw new HttpError('Post not found', 404);
    }

    let isLiked = false;

    if (userId && post.likes) {
      isLiked = post.likes.some(
        like => like.user && like.user.toString() === userId.toString()
      );
    }

    return {
      success: true,
      data: {
        likeCount: post.likeCount,
        isLiked: isLiked
      }
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError('Failed to get like status: ' + error.message, 500);
  }
}

/**
 * Get users who liked a post
 */
async getPostLikes(postId, page = 1, limit = 20) {
  try {
    const post = await Post.findById(postId);
    
    if (!post) {
      throw new HttpError('Post not found', 404);
    }

    const skip = (page - 1) * limit;
    
    // Get paginated likes with user details
    const likes = post.likes || [];
    const total = likes.length;
    
    const paginatedLikes = likes
      .sort((a, b) => b.likedAt - a.likedAt)
      .slice(skip, skip + limit);

    // Populate user details for likes that have user reference
    const populatedLikes = await Promise.all(
      paginatedLikes.map(async (like) => {
        if (like.user) {
          const User = require('../models/User');
          const user = await User.findById(like.user).select('name email profilePicture.url');
          return {
            ...like.toObject(),
            user: user
          };
        }
        return like;
      })
    );

    return {
      success: true,
      data: {
        likes: populatedLikes,
        totalLikes: total,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError('Failed to get post likes: ' + error.message, 500);
  }
}

}

module.exports = new PostService();