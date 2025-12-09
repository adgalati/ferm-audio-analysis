/**
 * MongoDB Service
 * Handles connection, CRUD operations, and sync queue management
 */

import { MongoClient } from 'mongodb';
import { validateRecord, COLLECTION_INDEXES } from '../utils/mongodb-schema.js';

let client = null;
let db = null;
let collection = null;

const COLLECTION_NAME = 'analysis_records';
const DB_NAME = 'ffactor-music';

/**
 * Initialize MongoDB connection
 * @param {string} uri - MongoDB connection URI
 * @returns {Promise<Object>} { success: boolean, message: string }
 */
export async function initializeConnection(uri) {
  try {
    if (client) {
      return { success: true, message: 'Already connected' };
    }

    client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 2
    });

    await client.connect();

    // Verify connection
    await client.db('admin').command({ ping: 1 });

    db = client.db(DB_NAME);
    collection = db.collection(COLLECTION_NAME);

    // Ensure indexes exist
    await ensureIndexes();

    console.log('[MongoDB] Successfully connected to MongoDB Atlas');
    return { success: true, message: 'Connected to MongoDB' };
  } catch (error) {
    console.error('[MongoDB] Connection error:', error);
    client = null;
    db = null;
    collection = null;
    return {
      success: false,
      message: `Connection failed: ${error.message}`
    };
  }
}

/**
 * Check if MongoDB is connected
 * @returns {boolean}
 */
export function isConnected() {
  return client !== null && db !== null && collection !== null;
}

/**
 * Ensure all required indexes exist
 * @private
 */
async function ensureIndexes() {
  if (!collection) throw new Error('Collection not initialized');

  for (const indexDef of COLLECTION_INDEXES) {
    try {
      await collection.createIndex(indexDef.key);
    } catch (error) {
      // Index may already exist, which is fine
      if (!error.message.includes('already exists')) {
        console.warn('[MongoDB] Index creation warning:', error.message);
      }
    }
  }
}

/**
 * Insert a single analysis record
 * @param {Object} record - Record to insert
 * @returns {Promise<Object>} { success: boolean, id?: string, error?: string }
 */
export async function insertRecord(record) {
  try {
    if (!collection) {
      throw new Error('MongoDB not connected');
    }

    // Validate record
    const validation = validateRecord(record);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join('; ')}`
      };
    }

    const result = await collection.insertOne(record);
    return {
      success: true,
      id: result.insertedId.toString()
    };
  } catch (error) {
    console.error('[MongoDB] Insert error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Query records with filtering and sorting
 * @param {Object} options - Query options
 * @returns {Promise<Object>} { success: boolean, records: Array, error?: string }
 */
export async function queryRecords(options = {}) {
  try {
    if (!collection) {
      throw new Error('MongoDB not connected');
    }

    const {
      dateFrom = null,
      dateTo = null,
      genreFilter = null,
      fermScoreMin = null,
      fermScoreMax = null,
      clipNameSearch = null,
      sortBy = 'date',
      sortOrder = -1,
      limit = 100,
      skip = 0,
      isFavorite = null,
      hasFermScore = null,
      timePeriod = null,
      sourceType = null
    } = options;

    // Build filter
    const filter = {};

    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) filter.date.$lte = new Date(dateTo);
    }

    if (genreFilter) {
      filter.topGenre = genreFilter;
    }

    if (fermScoreMin !== null || fermScoreMax !== null) {
      filter.fermFactor = {};
      if (fermScoreMin !== null) filter.fermFactor.$gte = fermScoreMin;
      if (fermScoreMax !== null) filter.fermFactor.$lte = fermScoreMax;
    }

    if (clipNameSearch) {
      filter.clipName = { $regex: clipNameSearch, $options: 'i' };
    }

    if (typeof isFavorite === 'boolean') {
      filter.isFavorite = isFavorite;
    }

    if (hasFermScore === true) {
      filter.fermFactor = { ...(filter.fermFactor || {}), $ne: null };
    }

    if (timePeriod) {
      filter.timePeriod = timePeriod;
    }

    if (sourceType) {
      filter.sourceType = sourceType;
    }

    // Build sort
    const sort = {};
    const sortField = sortBy === 'genre' ? 'topGenre' : sortBy;
    sort[sortField] = sortOrder;

    // Execute query
    const records = await collection
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get total count for pagination
    const total = await collection.countDocuments(filter);

    return {
      success: true,
      records: records.map(doc => ({
        ...doc,
        _id: doc._id.toString()
      })),
      total
    };
  } catch (error) {
    console.error('[MongoDB] Query error:', error);
    return {
      success: false,
      records: [],
      error: error.message
    };
  }
}

/**
 * Update favorite status and optional notes
 * @param {Object} payload { id?, clipName?, isFavorite, notes? }
 */
export async function updateFavoriteStatus(payload) {
  try {
    if (!collection) throw new Error('MongoDB not connected');

    const { id, clipName, isFavorite, notes } = payload;
    let filter = null;
    if (id) {
      const { ObjectId } = await import('mongodb');
      filter = { _id: new ObjectId(id) };
    } else if (clipName) {
      filter = { clipName };
    } else {
      throw new Error('Must provide id or clipName');
    }

    const update = {
      $set: {
        isFavorite: !!isFavorite,
        favoriteNotes: notes ?? null,
        favoriteMarkedAt: new Date()
      }
    };

    const result = await collection.updateOne(filter, update, { upsert: false });
    return { success: true, modifiedCount: result.modifiedCount };
  } catch (error) {
    console.error('[MongoDB] updateFavoriteStatus error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update source type (independent/mainstream)
 * @param {Object} payload { id, sourceType }
 */
export async function updateSourceType(id, sourceType) {
  try {
    if (!collection) throw new Error('MongoDB not connected');

    const { ObjectId } = await import('mongodb');
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { sourceType } }
    );

    return { success: true, modifiedCount: result.modifiedCount };
  } catch (error) {
    console.error('[MongoDB] updateSourceType error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update period fields for a record
 * @param {Object} payload { id, timePeriod, periodStart, periodEnd, periodType }
 */
export async function updatePeriod(payload) {
  try {
    if (!collection) throw new Error('MongoDB not connected');

    const { id, timePeriod, periodStart, periodEnd, periodType } = payload;
    const { ObjectId } = await import('mongodb');

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { timePeriod, periodStart, periodEnd, periodType } }
    );

    return { success: true, modifiedCount: result.modifiedCount };
  } catch (error) {
    console.error('[MongoDB] updatePeriod error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get list of unique periods with counts
 */
export async function getPeriodsList() {
  try {
    if (!collection) throw new Error('MongoDB not connected');

    const periods = await collection.distinct('timePeriod', { timePeriod: { $ne: null } });
    return { success: true, periods: periods.sort() };
  } catch (error) {
    console.error('[MongoDB] getPeriodsList error:', error);
    return { success: false, periods: [], error: error.message };
  }
}

/**
 * Create a new period entry (for tracking purposes)
 * @param {string} period - Period label
 * @param {Date} periodStart - Start date
 * @param {Date} periodEnd - End date
 * @param {string} periodType - 'weekly' or 'biweekly'
 * @returns {Promise<Object>} { success: boolean, id?: string, error?: string }
 */
export async function createPeriodEntry(period, periodStart, periodEnd, periodType) {
  try {
    if (!collection) throw new Error('MongoDB not connected');

    // Check if period already exists
    const existing = await collection.findOne({ timePeriod: period });
    if (existing) {
      return { success: true, id: existing._id.toString(), message: 'Period already exists' };
    }

    // Create a minimal period entry
    const periodEntry = {
      clipName: `PERIOD_${period}`,
      date: periodStart,
      timestamp: periodStart.getTime(),
      fermFactor: null,
      keyFit: { score: null, key: null, mode: null },
      timingTightness: null,
      loudness: { LUFS: null, LRA: null, TP: null },
      gainStaging: { deltaLufs: null, quality: null },
      genreTags: [],
      timingMetrics: null,
      inKeyPercentage: null,
      topGenre: null,
      topGenreWithStyle: null,
      analysisVersion: '1.0',
      isFavorite: false,
      favoriteMarkedAt: null,
      favoriteNotes: null,
      timePeriod: period,
      periodStart,
      periodEnd,
      periodType,
      isPeriodEntry: true // Flag to identify period entries
    };

    const result = await collection.insertOne(periodEntry);
    return { success: true, id: result.insertedId.toString() };
  } catch (error) {
    console.error('[MongoDB] createPeriodEntry error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get records for a given period
 */
export async function getRecordsByPeriod({ timePeriod, favoritesOnly = false, hasFermScore = false, limit = 100 }) {
  try {
    if (!collection) throw new Error('MongoDB not connected');

    const filter = { timePeriod };
    if (favoritesOnly) filter.isFavorite = true;
    if (hasFermScore) filter.fermFactor = { $ne: null };

    const recs = await collection.find(filter).sort({ date: -1 }).limit(limit).toArray();
    return {
      success: true,
      records: recs.map(doc => ({ ...doc, _id: doc._id.toString() }))
    };
  } catch (error) {
    console.error('[MongoDB] getRecordsByPeriod error:', error);
    return { success: false, records: [], error: error.message };
  }
}

/**
 * Get top N records by FERM Factor for a given period
 */
export async function getTopRecordsForPeriod({ timePeriod, favoritesOnly = false, limit = 10 }) {
  try {
    if (!collection) throw new Error('MongoDB not connected');

    const filter = { timePeriod, fermFactor: { $ne: null } };
    if (favoritesOnly) filter.isFavorite = true;

    const recs = await collection.find(filter).sort({ fermFactor: -1 }).limit(limit).toArray();
    return {
      success: true,
      records: recs.map(doc => ({ ...doc, _id: doc._id.toString() }))
    };
  } catch (error) {
    console.error('[MongoDB] getTopRecordsForPeriod error:', error);
    return { success: false, records: [], error: error.message };
  }
}

/**
 * Get unique genres from all records
 * @returns {Promise<Object>} { success: boolean, genres: Array, error?: string }
 */
export async function getUniqueGenres() {
  try {
    if (!collection) {
      throw new Error('MongoDB not connected');
    }

    const genres = await collection.distinct('topGenre');
    return {
      success: true,
      genres: genres.filter(g => g !== null).sort()
    };
  } catch (error) {
    console.error('[MongoDB] Distinct genres error:', error);
    return {
      success: false,
      genres: [],
      error: error.message
    };
  }
}

/**
 * Get statistics about stored records
 * @returns {Promise<Object>} { success: boolean, stats?: Object, error?: string }
 */
export async function getStatistics() {
  try {
    if (!collection) {
      throw new Error('MongoDB not connected');
    }

    const total = await collection.countDocuments();
    const avgFermFactor = await collection.aggregate([
      { $match: { fermFactor: { $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$fermFactor' } } }
    ]).toArray();

    const dateRange = await collection.aggregate([
      { $match: { date: { $ne: null } } },
      {
        $group: {
          _id: null,
          earliest: { $min: '$date' },
          latest: { $max: '$date' }
        }
      }
    ]).toArray();

    return {
      success: true,
      stats: {
        totalRecords: total,
        averageFermFactor: avgFermFactor[0]?.avg || null,
        dateRange: dateRange[0] ? {
          earliest: dateRange[0].earliest,
          latest: dateRange[0].latest
        } : null
      }
    };
  } catch (error) {
    console.error('[MongoDB] Statistics error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Close MongoDB connection
 * @returns {Promise<void>}
 */
export async function closeConnection() {
  if (client) {
    try {
      await client.close();
      console.log('[MongoDB] Connection closed');
    } catch (error) {
      console.error('[MongoDB] Close error:', error);
    } finally {
      client = null;
      db = null;
      collection = null;
    }
  }
}

/**
 * Test connection without storing data
 * @returns {Promise<Object>} { success: boolean, message: string }
 */
export async function testConnection() {
  try {
    if (!client) {
      return { success: false, message: 'Not connected' };
    }

    await client.db('admin').command({ ping: 1 });
    return { success: true, message: 'Connection is healthy' };
  } catch (error) {
    console.error('[MongoDB] Health check failed:', error);
    return { success: false, message: `Health check failed: ${error.message}` };
  }
}

/**
 * Update FERM Factor score for a record.
 * @param {string} id - Record ID.
 * @param {number|null} fermFactor - New FERM Factor score (null to reset).
 * @returns {Promise<Object>} { success: boolean, modifiedCount?: number, error?: string }
 */
export async function updateRecordFermFactor(id, fermFactor) {
  try {
    if (!collection) throw new Error('MongoDB not connected');
    const { ObjectId } = await import('mongodb');
    const updateDoc = {
      $set: {
        fermFactor: fermFactor
      }
    };
    const result = await collection.updateOne({ _id: new ObjectId(id) }, updateDoc);
    return { success: true, modifiedCount: result.modifiedCount };
  } catch (error) {
    console.error('[MongoDB] Update FERM Factor error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a record by ID
 * @param {string} id - Record ID
 * @returns {Promise<Object>} { success: boolean, deletedCount?: number, error?: string }
 */
export async function deleteRecord(id) {
  try {
    if (!collection) {
      throw new Error('MongoDB not connected');
    }

    const { ObjectId } = await import('mongodb');
    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    return {
      success: true,
      deletedCount: result.deletedCount
    };
  } catch (error) {
    console.error('[MongoDB] Delete error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Export records as an array (for bulk export)
 * @param {Object} filters - Query filters
 * @returns {Promise<Object>} { success: boolean, records?: Array, error?: string }
 */
export async function exportRecords(filters = {}) {
  try {
    const result = await queryRecords({ ...filters, limit: 10000 });
    if (!result.success) {
      throw new Error(result.error);
    }
    return {
      success: true,
      records: result.records
    };
  } catch (error) {
    console.error('[MongoDB] Export error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
