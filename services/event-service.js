const Event = require('../models/Event');
const User = require('../models/User');
const HttpError = require('../middleware/HttpError');
const { emailService } = require('./email-service');
const { cloudinary } = require('../config/cloudinary');
const fs = require('fs');

class EventService {
  /**
   * Create a new event
   */
  async createEvent(eventData, userId) {
    try {
      const { title, description, location, date, startTime, capacity, organizer, category } = eventData;

      // Validate required fields
      if (!title || !description || !location || !date || !startTime || !capacity) {
        throw new HttpError('Missing required event fields', 400);
      }

      // Generate slug from title
      let slug = this.generateSlug(title);
      slug = await this.makeSlugUnique(slug);

      // Create event
      const event = new Event({
        ...eventData,
        slug,
        createdBy: userId,
        currentAttendees: 0,
        viewCount: 0
      });

      await event.save();

      return {
        success: true,
        message: 'Event created successfully',
        data: event
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to create event: ' + error.message, 500);
    }
  }

  /**
   * Update an event
   */
  async updateEvent(eventId, updateData, userId) {
    try {
      const event = await Event.findById(eventId);
      
      if (!event) {
        throw new HttpError('Event not found', 404);
      }

      // Check if user is authorized (creator or admin)
      if (event.createdBy.toString() !== userId) {
        const user = await User.findById(userId);
        if (!user || user.role !== 'admin') {
          throw new HttpError('Not authorized to update this event', 403);
        }
      }

      // If title is being updated, generate new slug
      if (updateData.title && updateData.title !== event.title) {
        let slug = this.generateSlug(updateData.title);
        slug = await this.makeSlugUnique(slug, eventId);
        updateData.slug = slug;
      }

      // Update fields
      Object.keys(updateData).forEach(key => {
        if (key !== '_id' && key !== '__v' && key !== 'createdAt') {
          event[key] = updateData[key];
        }
      });

      await event.save();

      return {
        success: true,
        message: 'Event updated successfully',
        data: event
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to update event: ' + error.message, 500);
    }
  }

  /**
   * Get event by slug (public view)
   */
  async getEventBySlug(slug) {
    try {
      const event = await Event.findOne({ slug });
      
      if (!event) {
        throw new HttpError('Event not found', 404);
      }

      // Increment view count
      await event.incrementViews();

      return {
        success: true,
        data: event
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to fetch event', 500);
    }
  }

  /**
   * Get event by ID (admin view)
   */
  async getEventById(eventId) {
    try {
      const event = await Event.findById(eventId)
        .populate('createdBy', 'name email');
      
      if (!event) {
        throw new HttpError('Event not found', 404);
      }

      return {
        success: true,
        data: event
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to fetch event', 500);
    }
  }

  /**
   * Get all upcoming events with pagination
   */
  async getUpcomingEvents(page = 1, limit = 10, category = null) {
    try {
      const skip = (page - 1) * limit;
      let filter = { 
        date: { $gte: new Date() },
        status: 'upcoming'
      };

      if (category && category !== 'all') {
        filter.category = category;
      }

      const events = await Event.find(filter)
        .populate('createdBy', 'name')
        .sort({ date: 1, priority: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Event.countDocuments(filter);

      return {
        success: true,
        data: events,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new HttpError('Failed to fetch events', 500);
    }
  }

  /**
   * Get all events for admin
   */
  async getAllEventsForAdmin(page = 1, limit = 20, status = null) {
    try {
      const skip = (page - 1) * limit;
      let filter = {};
      
      if (status && status !== 'all') {
        filter.status = status;
      }

      const events = await Event.find(filter)
        .populate('createdBy', 'name email')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Event.countDocuments(filter);

      return {
        success: true,
        data: events,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new HttpError('Failed to fetch events', 500);
    }
  }

  /**
   * Get featured events
   */
  async getFeaturedEvents(limit = 5) {
    try {
      const events = await Event.find({ 
        isFeatured: true,
        date: { $gte: new Date() },
        status: 'upcoming'
      })
      .populate('createdBy', 'name')
      .sort({ priority: -1, date: 1 })
      .limit(limit);

      return {
        success: true,
        data: events
      };
    } catch (error) {
      throw new HttpError('Failed to fetch featured events', 500);
    }
  }

  /**
   * Search events
   */
  async searchEvents(query, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      
      const events = await Event.find(
        { 
          $text: { $search: query },
          date: { $gte: new Date() },
          status: 'upcoming'
        },
        { score: { $meta: 'textScore' } }
      )
      .populate('createdBy', 'name')
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limit);

      const total = await Event.countDocuments({ 
        $text: { $search: query },
        date: { $gte: new Date() },
        status: 'upcoming'
      });

      return {
        success: true,
        data: events,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        query
      };
    } catch (error) {
      throw new HttpError('Failed to search events', 500);
    }
  }

  /**
   * Get events by category
   */
  async getEventsByCategory(category, page = 1, limit = 10) {
    return await this.getUpcomingEvents(page, limit, category);
  }

  /**
   * RSVP to an event
   */
  async rsvpToEvent(eventId, rsvpData) {
    try {
      const event = await Event.findById(eventId);
      
      if (!event) {
        throw new HttpError('Event not found', 404);
      }

      // Check if event is still upcoming
      if (!event.isUpcoming()) {
        throw new HttpError('This event is no longer accepting RSVPs', 400);
      }

      // Check capacity
      if (!event.hasAvailableSpots()) {
        throw new HttpError('Event is at full capacity', 400);
      }

      // Add RSVP
      const updatedEvent = await event.addRSVP(rsvpData);

      // Send confirmation email
      await this.sendRSVPConfirmationEmail(rsvpData, event);

      return {
        success: true,
        message: 'RSVP submitted successfully',
        data: {
          event: updatedEvent,
          rsvp: updatedEvent.rsvps[updatedEvent.rsvps.length - 1]
        }
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to submit RSVP: ' + error.message, 500);
    }
  }

  /**
   * Cancel RSVP
   */
  async cancelRSVP(eventId, email) {
    try {
      const event = await Event.findById(eventId);
      
      if (!event) {
        throw new HttpError('Event not found', 404);
      }

      await event.cancelRSVP(email);

      return {
        success: true,
        message: 'RSVP cancelled successfully'
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to cancel RSVP: ' + error.message, 500);
    }
  }

  /**
   * Get event RSVPs
   */
  async getEventRSVPs(eventId, page = 1, limit = 50) {
    try {
      const event = await Event.findById(eventId);
      
      if (!event) {
        throw new HttpError('Event not found', 404);
      }

      const skip = (page - 1) * limit;
      const rsvps = event.rsvps.slice(skip, skip + limit);
      const total = event.rsvps.length;

      return {
        success: true,
        data: rsvps,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        stats: {
          totalAttendees: event.currentAttendees,
          capacity: event.capacity,
          remainingSpots: event.getRemainingSpots()
        }
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to fetch RSVPs', 500);
    }
  }

  /**
   * Upload event featured image
   */
  async uploadFeaturedImage(eventId, file, alt = '', caption = '') {
    try {
      const event = await Event.findById(eventId);
      
      if (!event) {
        throw new HttpError('Event not found', 404);
      }

      // Delete old featured image if exists
      if (event.featuredImage && event.featuredImage.publicId) {
        await cloudinary.uploader.destroy(event.featuredImage.publicId);
      }

      let imageUrl, publicId;
      
      if (file.path && file.path.includes('cloudinary')) {
        imageUrl = file.path;
        publicId = file.filename;
      } else if (file.path) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'campaign/events/featured',
          width: 1200,
          height: 630,
          crop: 'fill',
          quality: 'auto'
        });
        imageUrl = result.secure_url;
        publicId = result.public_id;
        
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } else {
        throw new HttpError('Invalid file data', 400);
      }

      event.featuredImage = {
        url: imageUrl,
        publicId: publicId,
        caption: caption,
        alt: alt || event.title,
        cloudinaryUrl: imageUrl
      };

      await event.save();

      return {
        success: true,
        message: 'Featured image uploaded successfully',
        data: event.featuredImage
      };
    } catch (error) {
      if (file && file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new HttpError('Failed to upload featured image: ' + error.message, 500);
    }
  }

  /**
   * Upload event gallery images
   */
  async uploadGalleryImages(eventId, files) {
    try {
      const event = await Event.findById(eventId);
      
      if (!event) {
        throw new HttpError('Event not found', 404);
      }

      const uploadedImages = [];

      for (const file of files) {
        let imageUrl, publicId;
        
        if (file.path && file.path.includes('cloudinary')) {
          imageUrl = file.path;
          publicId = file.filename;
        } else if (file.path) {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'campaign/events/gallery',
            quality: 'auto'
          });
          imageUrl = result.secure_url;
          publicId = result.public_id;
          
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } else {
          continue;
        }

        uploadedImages.push({
          url: imageUrl,
          publicId: publicId,
          caption: '',
          cloudinaryUrl: imageUrl,
          uploadedAt: new Date()
        });
      }

      event.gallery.push(...uploadedImages);
      await event.save();

      return {
        success: true,
        message: `${uploadedImages.length} images uploaded successfully`,
        data: event.gallery
      };
    } catch (error) {
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
  async removeGalleryImage(eventId, imagePublicId) {
    try {
      const event = await Event.findById(eventId);
      
      if (!event) {
        throw new HttpError('Event not found', 404);
      }

      await cloudinary.uploader.destroy(imagePublicId);

      event.gallery = event.gallery.filter(img => img.publicId !== imagePublicId);
      await event.save();

      return {
        success: true,
        message: 'Image removed successfully'
      };
    } catch (error) {
      throw new HttpError('Failed to remove image', 500);
    }
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId) {
    try {
      const event = await Event.findById(eventId);
      
      if (!event) {
        throw new HttpError('Event not found', 404);
      }

      // Delete featured image from Cloudinary if exists
      if (event.featuredImage && event.featuredImage.publicId) {
        await cloudinary.uploader.destroy(event.featuredImage.publicId);
      }

      // Delete gallery images from Cloudinary
      if (event.gallery && event.gallery.length > 0) {
        for (const image of event.gallery) {
          if (image.publicId) {
            await cloudinary.uploader.destroy(image.publicId);
          }
        }
      }

      await event.deleteOne();

      return {
        success: true,
        message: 'Event deleted successfully'
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to delete event', 500);
    }
  }

  /**
   * Get event statistics for admin dashboard
   */
  async getEventStats() {
    try {
      const total = await Event.countDocuments();
      const upcoming = await Event.countDocuments({ 
        date: { $gte: new Date() },
        status: 'upcoming'
      });
      const completed = await Event.countDocuments({ 
        date: { $lt: new Date() },
        status: { $ne: 'cancelled' }
      });
      const cancelled = await Event.countDocuments({ status: 'cancelled' });
      
      const totalAttendees = await Event.aggregate([
        { $group: { _id: null, total: { $sum: '$currentAttendees' } } }
      ]);
      
      const totalRSVPs = await Event.aggregate([
        { $project: { rsvpCount: { $size: '$rsvps' } } },
        { $group: { _id: null, total: { $sum: '$rsvpCount' } } }
      ]);

      const categoryStats = await Event.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]);

      return {
        success: true,
        data: {
          total,
          upcoming,
          completed,
          cancelled,
          totalAttendees: totalAttendees[0]?.total || 0,
          totalRSVPs: totalRSVPs[0]?.total || 0,
          categoryStats
        }
      };
    } catch (error) {
      throw new HttpError('Failed to fetch event statistics', 500);
    }
  }

  /**
   * Helper: Send RSVP confirmation email
   */
  async sendRSVPConfirmationEmail(rsvpData, event) {
    try {
      const emailData = {
        to: rsvpData.email,
        subject: `RSVP Confirmation: ${event.title}`,
        template: 'rsvp-confirmation',
        data: {
          fullName: rsvpData.fullName,
          eventTitle: event.title,
          eventDate: event.formattedDate,
          eventTime: event.formattedTime,
          eventLocation: event.location,
          guests: rsvpData.guests,
          eventId: event._id
        }
      };

      await emailService.sendEmail(emailData);
    } catch (error) {
      console.error('Failed to send RSVP confirmation email:', error);
    }
  }

  /**
   * Helper: Generate slug from title
   */
  generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Helper: Make slug unique
   */
  async makeSlugUnique(baseSlug, excludeId = null) {
    let slug = baseSlug;
    let counter = 1;
    let exists = true;
    
    while (exists) {
      const query = { slug };
      if (excludeId) {
        query._id = { $ne: excludeId };
      }
      const existingEvent = await Event.findOne(query);
      if (!existingEvent) {
        exists = false;
      } else {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
    }
    
    return slug;
  }
}

module.exports = new EventService();