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

/**
 * One-time migration: retroactively apply the 10% genre-confidence gate
 * to all existing records. For each record:
 *   - Reads genreTags[0].score
 *   - If < GENRE_CONFIDENCE_THRESHOLD → sets topGenre / topGenreWithStyle to "Other"
 *   - Backfills topGenreConfidence field
 * Records that already have topGenre === "Other" or have no genreTags are skipped.
 * @param {number} threshold - Confidence threshold (default 0.10)
 * @returns {Promise<Object>} { success, migratedCount, skippedCount, error? }
 */
export async function migrateGenreConfidence(threshold = 0.10) {
  try {
    if (!collection) throw new Error('MongoDB not connected');

    // Find all records that have at least one genre tag
    const cursor = collection.find({ 'genreTags.0': { $exists: true } });
    let migratedCount = 0;
    let skippedCount = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      const topTag = doc.genreTags[0];
      if (!topTag || typeof topTag.score !== 'number') {
        skippedCount++;
        continue;
      }

      const score = topTag.score;
      const needsGate = score < threshold;

      // Determine what the correct topGenre should be
      const correctTopGenre = needsGate ? 'Other' : topTag.genre;
      const correctTopGenreWithStyle = needsGate
        ? 'Other'
        : (topTag.subgenre ? `${topTag.genre} - ${topTag.subgenre}` : topTag.genre);

      // Check if an update is actually needed
      const needsUpdate =
        doc.topGenre !== correctTopGenre ||
        doc.topGenreWithStyle !== correctTopGenreWithStyle ||
        doc.topGenreConfidence === undefined;

      if (!needsUpdate) {
        skippedCount++;
        continue;
      }

      await collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            topGenre: correctTopGenre,
            topGenreWithStyle: correctTopGenreWithStyle,
            topGenreConfidence: score
          }
        }
      );
      migratedCount++;
    }

    console.log(`[MongoDB] Genre confidence migration complete: ${migratedCount} updated, ${skippedCount} skipped`);
    return { success: true, migratedCount, skippedCount };
  } catch (error) {
    console.error('[MongoDB] Genre confidence migration error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Override the official top genre label for a record.
 * The original auto-detected genre is preserved in a `genreOverride` sub-document.
 * Pass `tagIndex = null` or `tagIndex = -1` to clear the override and revert to auto-detected.
 *
 * @param {Object} payload
 * @param {string} payload.clipName - clip name to look up
 * @param {number|null} payload.tagIndex - index into genreTags to promote (null/-1 to clear)
 * @returns {Promise<Object>} { success, topGenre?, topGenreWithStyle?, error? }
 */
export async function updateGenreOverride(payload) {
  try {
    if (!collection) throw new Error('MongoDB not connected');

    const { clipName, tagIndex } = payload;
    if (!clipName) throw new Error('clipName is required');

    // Find the record
    const doc = await collection.findOne(
      { clipName: { $regex: `^${clipName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }
    );
    if (!doc) return { success: false, error: 'Record not found' };
    if (!doc.genreTags || doc.genreTags.length === 0) {
      return { success: false, error: 'Record has no genre tags' };
    }

    // Clearing the override — revert to auto-detected
    if (tagIndex === null || tagIndex === -1) {
      const autoTag = doc.genreTags[0];
      const autoGenre = autoTag.score >= 0.10 ? autoTag.genre : 'Other';
      const autoStyle = autoTag.score >= 0.10
        ? (autoTag.subgenre ? `${autoTag.genre} - ${autoTag.subgenre}` : autoTag.genre)
        : 'Other';

      await collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            topGenre: autoGenre,
            topGenreWithStyle: autoStyle,
          },
          $unset: { genreOverride: '' }
        }
      );
      console.log(`[MongoDB] Genre override cleared for "${clipName}" → reverted to "${autoGenre}"`);
      return { success: true, topGenre: autoGenre, topGenreWithStyle: autoStyle, overrideCleared: true };
    }

    // Validate tagIndex
    if (tagIndex < 0 || tagIndex >= doc.genreTags.length) {
      return { success: false, error: `tagIndex ${tagIndex} out of range (0-${doc.genreTags.length - 1})` };
    }

    const chosenTag = doc.genreTags[tagIndex];
    const newTopGenre = chosenTag.genre;
    const newTopGenreWithStyle = chosenTag.subgenre
      ? `${chosenTag.genre} - ${chosenTag.subgenre}`
      : chosenTag.genre;

    // Preserve the original auto-detected values (only if not already overridden)
    const originalTopGenre = doc.genreOverride?.originalTopGenre || doc.topGenre;
    const originalTopGenreWithStyle = doc.genreOverride?.originalTopGenreWithStyle || doc.topGenreWithStyle;

    await collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          topGenre: newTopGenre,
          topGenreWithStyle: newTopGenreWithStyle,
          genreOverride: {
            originalTopGenre,
            originalTopGenreWithStyle,
            chosenTagIndex: tagIndex,
            overriddenAt: new Date()
          }
        }
      }
    );

    console.log(`[MongoDB] Genre override for "${clipName}": "${originalTopGenre}" → "${newTopGenre}" (tag #${tagIndex})`);
    return { success: true, topGenre: newTopGenre, topGenreWithStyle: newTopGenreWithStyle };
  } catch (error) {
    console.error('[MongoDB] updateGenreOverride error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update the affinity training label for a record.
 * This is the raw precursor label (0–4) used to train the FERM Affinity classifier.
 * NOT the final fermAffinity score — that name is reserved for classifier output.
 *
 * @param {string} id - Record _id
 * @param {number|null} affinityLabel - Integer 0–4, or null to clear
 * @returns {Promise<Object>} { success, modifiedCount, error? }
 */
export async function updateAffinityLabel(id, affinityLabel) {
  try {
    if (!collection) throw new Error('MongoDB not connected');
    const { ObjectId } = await import('mongodb');

    let update;
    if (affinityLabel === null || affinityLabel === undefined) {
      update = { $unset: { affinityLabel: '', affinityLabeledAt: '' } };
    } else {
      const val = parseInt(affinityLabel, 10);
      if (isNaN(val) || val < 0 || val > 4) {
        return { success: false, error: 'affinityLabel must be an integer 0–4 or null' };
      }
      update = { $set: { affinityLabel: val, affinityLabeledAt: new Date() } };
    }

    const result = await collection.updateOne({ _id: new ObjectId(id) }, update);
    return { success: true, modifiedCount: result.modifiedCount };
  } catch (error) {
    console.error('[MongoDB] updateAffinityLabel error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update the AI-generated training label for a record.
 * Binary: 0 = not AI, 1 = AI-generated (or very likely).
 * NOT the final isAiGenerated classifier output — that name is reserved.
 *
 * @param {string} id - Record _id
 * @param {number|null} aiGeneratedLabel - 0 or 1, or null to clear
 * @returns {Promise<Object>} { success, modifiedCount, error? }
 */
export async function updateAiGeneratedLabel(id, aiGeneratedLabel) {
  try {
    if (!collection) throw new Error('MongoDB not connected');
    const { ObjectId } = await import('mongodb');

    let update;
    if (aiGeneratedLabel === null || aiGeneratedLabel === undefined) {
      update = { $unset: { aiGeneratedLabel: '', aiGeneratedLabeledAt: '' } };
    } else {
      const val = parseInt(aiGeneratedLabel, 10);
      if (val !== 0 && val !== 1) {
        return { success: false, error: 'aiGeneratedLabel must be 0, 1, or null' };
      }
      update = { $set: { aiGeneratedLabel: val, aiGeneratedLabeledAt: new Date() } };
    }

    const result = await collection.updateOne({ _id: new ObjectId(id) }, update);
    return { success: true, modifiedCount: result.modifiedCount };
  } catch (error) {
    console.error('[MongoDB] updateAiGeneratedLabel error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Query records for affinity / AI-generated labeling.
 * Always filters to records that have an embedding (embeddingPath is non-null).
 *
 * @param {Object} options
 * @param {string}  [options.clipNameSearch]     - text search on clipName
 * @param {string}  [options.genreFilter]        - filter by topGenre
 * @param {string}  [options.sortBy='date']      - sort field
 * @param {number}  [options.sortOrder=-1]       - 1 = asc, -1 = desc
 * @param {number}  [options.limit=50]
 * @param {number}  [options.skip=0]
 * @param {boolean} [options.labeledOnly]        - true = only affinity-labeled, false = unlabeled only, null/undefined = all
 * @param {number}  [options.affinityValue]      - filter to a specific affinityLabel value (0–4)
 * @param {boolean} [options.excludeAiGenerated] - when true, exclude records where aiGeneratedLabel === 1
 * @param {boolean} [options.aiLabeledOnly]      - true = only AI-labeled, false = AI-unlabeled only, null = all
 * @param {number}  [options.aiGeneratedValue]   - filter to a specific aiGeneratedLabel value (0 or 1)
 * @returns {Promise<Object>} { success, records, total, stats, error? }
 */
export async function queryRecordsForAffinity(options = {}) {
  try {
    if (!collection) throw new Error('MongoDB not connected');

    const {
      clipNameSearch = null,
      genreFilter = null,
      sortBy = 'date',
      sortOrder = -1,
      limit = 50,
      skip = 0,
      labeledOnly = null,
      affinityValue = null,
      excludeAiGenerated = false,
      aiLabeledOnly = null,
      aiGeneratedValue = null
    } = options;

    // Base: must have an embedding
    const filter = {
      embeddingPath: { $exists: true, $ne: null }
    };

    // Exclude period-marker entries
    filter.isPeriodEntry = { $ne: true };

    // Clip name search
    if (clipNameSearch) {
      filter.clipName = { $regex: clipNameSearch, $options: 'i' };
    }

    // Genre filter
    if (genreFilter) {
      filter.topGenre = genreFilter;
    }

    // Affinity label filters
    if (affinityValue !== null && affinityValue !== undefined) {
      filter.affinityLabel = parseInt(affinityValue, 10);
    } else if (labeledOnly === true) {
      filter.affinityLabel = { $exists: true, $ne: null };
    } else if (labeledOnly === false) {
      filter.$or = filter.$or || [];
      filter.$or.push(
        { affinityLabel: { $exists: false } },
        { affinityLabel: null }
      );
    }

    // AI-generated label filters
    if (aiGeneratedValue !== null && aiGeneratedValue !== undefined) {
      filter.aiGeneratedLabel = parseInt(aiGeneratedValue, 10);
    } else if (aiLabeledOnly === true) {
      filter.aiGeneratedLabel = { $exists: true, $ne: null };
    } else if (aiLabeledOnly === false) {
      // Unlabeled AI records
      const aiOrConditions = [
        { aiGeneratedLabel: { $exists: false } },
        { aiGeneratedLabel: null }
      ];
      if (filter.$or) {
        // Need to combine with $and since we already have $or
        const existingOr = filter.$or;
        delete filter.$or;
        filter.$and = [
          { $or: existingOr },
          { $or: aiOrConditions }
        ];
      } else {
        filter.$or = aiOrConditions;
      }
    }

    // Exclude AI-generated tracks from affinity training queries
    if (excludeAiGenerated) {
      filter.aiGeneratedLabel = { $ne: 1 };
    }

    // Sort
    const sort = {};
    const sortField = sortBy === 'genre' ? 'topGenre' : sortBy;
    sort[sortField] = sortOrder;

    // Execute
    const records = await collection
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await collection.countDocuments(filter);

    // Gather labeling stats (on the base embedding filter only, for the stats banner)
    const baseFilter = {
      embeddingPath: { $exists: true, $ne: null },
      isPeriodEntry: { $ne: true }
    };
    const [totalEmbedded, affinityLabeledCount, aiLabeledCount, aiPositiveCount] = await Promise.all([
      collection.countDocuments(baseFilter),
      collection.countDocuments({ ...baseFilter, affinityLabel: { $exists: true, $ne: null } }),
      collection.countDocuments({ ...baseFilter, aiGeneratedLabel: { $exists: true, $ne: null } }),
      collection.countDocuments({ ...baseFilter, aiGeneratedLabel: 1 })
    ]);

    // Distribution of affinity labels 0–4
    const affinityDistribution = {};
    for (let v = 0; v <= 4; v++) {
      affinityDistribution[v] = await collection.countDocuments({ ...baseFilter, affinityLabel: v });
    }

    return {
      success: true,
      records: records.map(doc => ({
        ...doc,
        _id: doc._id.toString()
      })),
      total,
      stats: {
        totalEmbedded,
        affinityLabeled: affinityLabeledCount,
        affinityUnlabeled: totalEmbedded - affinityLabeledCount,
        affinityDistribution,
        aiLabeled: aiLabeledCount,
        aiUnlabeled: totalEmbedded - aiLabeledCount,
        aiPositive: aiPositiveCount,
        aiNegative: aiLabeledCount - aiPositiveCount
      }
    };
  } catch (error) {
    console.error('[MongoDB] queryRecordsForAffinity error:', error);
    return { success: false, records: [], total: 0, error: error.message };
  }
}
