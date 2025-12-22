/**
 * FAISS Search Service
 * Node.js wrapper for the Python FAISS search CLI.
 * 
 * Provides functions for:
 * - Adding embeddings to the index (auto-called after analysis)
 * - Finding similar tracks
 * - Computing novelty scores
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadWindowsEnv, getProjectRoot } from '../utils/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let env = null;

function getEnv() {
    if (!env) {
        env = loadWindowsEnv();
    }
    return env;
}

/**
 * Execute a command on the FAISS search CLI.
 * @param {Object} command - Command object to send
 * @returns {Promise<Object>} - Result from Python script
 */
async function runSearchCommand(command) {
    return new Promise((resolve, reject) => {
        const projectRoot = getProjectRoot();
        const pythonPath = path.join(projectRoot, '.venv/Scripts/python.exe');
        const scriptPath = path.join(projectRoot, 'scripts/search_faiss.py');

        const proc = spawn(pythonPath, [scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('close', (code) => {
            if (code !== 0) {
                console.error('[Search Service] Python script error:', stderr);
                reject(new Error(`Search script exited with code ${code}: ${stderr}`));
                return;
            }

            try {
                const result = JSON.parse(stdout.trim());
                resolve(result);
            } catch (e) {
                reject(new Error(`Failed to parse search result: ${stdout}`));
            }
        });

        proc.on('error', (err) => {
            reject(new Error(`Failed to spawn search script: ${err.message}`));
        });

        // Send command as JSON
        proc.stdin.write(JSON.stringify(command));
        proc.stdin.end();
    });
}

/**
 * Add a single embedding to the FAISS index.
 * Called automatically after analysis completes with embeddings.
 * 
 * @param {Object} options
 * @param {string} options.mongoId - MongoDB document _id
 * @param {string} options.embeddingPath - Path to .npy embedding file
 * @param {string} [options.sourceType='independent'] - 'independent' or 'mainstream'
 * @param {string} [options.clipName] - Track name
 * @param {string} [options.topGenre] - Genre label
 * @returns {Promise<Object>} - { success: boolean, index_size?: number, error?: string }
 */
export async function addToIndex({ mongoId, embeddingPath, sourceType = 'independent', clipName, topGenre }) {
    console.log('[Search Service] Adding to index:', mongoId);

    try {
        const result = await runSearchCommand({
            command: 'add_to_index',
            mongo_id: mongoId,
            embedding_path: embeddingPath,
            source_type: sourceType,
            clip_name: clipName,
            top_genre: topGenre
        });

        if (result.success) {
            console.log('[Search Service] Added to index. Total size:', result.index_size);
        } else {
            console.error('[Search Service] Failed to add to index:', result.error);
        }

        return result;
    } catch (error) {
        console.error('[Search Service] Error adding to index:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Find similar tracks to the given track.
 * 
 * @param {Object} options
 * @param {string} options.mongoId - MongoDB document _id
 * @param {string} options.embeddingPath - Path to .npy embedding file
 * @param {number} [options.k=5] - Number of neighbors to return
 * @param {string} [options.sourceTypeFilter] - 'mainstream', 'independent', or null for all
 * @returns {Promise<Object>} - { success: boolean, results?: Array, error?: string }
 */
export async function findSimilar({ mongoId, embeddingPath, k = 5, sourceTypeFilter = null }) {
    console.log('[Search Service] Finding similar tracks for:', mongoId, 'filter:', sourceTypeFilter);

    try {
        const result = await runSearchCommand({
            command: 'find_similar',
            mongo_id: mongoId,
            embedding_path: embeddingPath,
            k,
            source_type_filter: sourceTypeFilter
        });

        return result;
    } catch (error) {
        console.error('[Search Service] Error finding similar:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Compute novelty score for a track.
 * Higher score = more unique/outlier in the collection.
 * 
 * @param {Object} options
 * @param {string} options.mongoId - MongoDB document _id
 * @param {string} options.embeddingPath - Path to .npy embedding file
 * @param {number} [options.k=10] - Number of neighbors to consider
 * @param {string} [options.sourceTypeFilter] - 'mainstream', 'independent', or null for all
 * @returns {Promise<Object>} - { success: boolean, novelty_score?: number, error?: string }
 */
export async function computeNovelty({ mongoId, embeddingPath, k = 10, sourceTypeFilter = null }) {
    console.log('[Search Service] Computing novelty for:', mongoId, 'filter:', sourceTypeFilter);

    try {
        const result = await runSearchCommand({
            command: 'compute_novelty',
            mongo_id: mongoId,
            embedding_path: embeddingPath,
            k,
            source_type_filter: sourceTypeFilter
        });

        return result;
    } catch (error) {
        console.error('[Search Service] Error computing novelty:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get index status.
 * 
 * @returns {Promise<Object>} - { success: boolean, index_exists: boolean, index_size: number }
 */
export async function getIndexStatus() {
    try {
        const result = await runSearchCommand({ command: 'status' });
        return result;
    } catch (error) {
        console.error('[Search Service] Error getting status:', error);
        return { success: false, error: error.message };
    }
}
