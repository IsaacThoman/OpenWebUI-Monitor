import { createHash, randomBytes } from 'crypto'

import {
    DEFAULT_LEADERBOARD_BAR_COLOR,
    LEADERBOARD_BAR_COLORS,
} from '@/lib/user-portal-constants'
import { compareDayKeys } from '@/lib/date/day-key'

import { query } from './client'

export interface User {
    id: string
    email: string
    name: string
    role: string
    balance: number
    deleted?: boolean
    has_viewer_token?: boolean
    viewer_token?: string | null
    created_at?: string | null
    leaderboard_show_name?: boolean
    leaderboard_nickname?: string | null
    leaderboard_color?: string | null
}

interface CreateUserInput {
    id: string
    email: string
    name: string
    role?: string
}

export interface UserPortalStats {
    profile: {
        id: string
        email: string
        name: string
        role: string
        balance: number
        viewerToken: string | null
        createdAt: string | null
        showNameOnLeaderboard: boolean
        leaderboardNickname: string | null
        leaderboardColor: string | null
    }
    overview: {
        totalCost: number
        totalCalls: number
        totalTokens: number
        averageCost: number
        firstUseTime: string | null
        lastUseTime: string | null
    }
    recentWindow: {
        totalCost: number
        totalCalls: number
        totalTokens: number
    }
    topModels: Array<{
        modelName: string
        totalCost: number
        totalCalls: number
        totalTokens: number
    }>
    recentRecords: Array<{
        id: number
        useTime: string
        modelName: string
        inputTokens: number
        outputTokens: number
        totalTokens: number
        cost: number
        balanceAfter: number
    }>
}

export interface LeaderboardEntry {
    userId: string
    displayName: string
    isAnonymous: boolean
    leaderboardColor: string | null
    totalCalls: number
    totalTokens: number
    totalCost: number
    averageCost: number
}

export interface LeaderboardStats {
    totalCalls: number
    totalTokens: number
    totalCost: number
    averageCost: number
    firstUseTime: string | null
    lastUseTime: string | null
    users: LeaderboardEntry[]
    dailyUsage: Array<{
        date: string
        totalCost: number
        totalTokens: number
        totalCalls: number
        models: Array<{
            name: string
            cost: number
            tokens: number
            calls: number
        }>
    }>
    contributionDailyUsage: Array<{
        date: string
        totalCost: number
        totalTokens: number
        totalCalls: number
        models: Array<{
            name: string
            cost: number
            tokens: number
            calls: number
        }>
    }>
    topModels: Array<{
        modelName: string
        totalCost: number
        totalCalls: number
    }>
    recentRecords: Array<{
        id: number
        useTime: string
        modelName: string
        totalTokens: number
        cost: number
        balanceAfter: number
        displayName: string
        isAnonymous: boolean
    }>
    recentRecordsPagination: {
        page: number
        pageSize: number
        total: number
        totalPages: number
    }
    mostExpensiveCall: MostExpensiveCall | null
}

export interface MostExpensiveCall {
    userId: string
    displayName: string
    isAnonymous: boolean
    modelName: string
    inputTokens: number
    outputTokens: number
    totalTokens: number
    cost: number
    useTime: string
}

function hashViewerToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
}

function generateViewerToken(): string {
    return randomBytes(24).toString('base64url')
}

async function ensureViewerTokenColumnsExist() {
    await query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS viewer_token TEXT,
      ADD COLUMN IF NOT EXISTS viewer_token_hash TEXT,
      ADD COLUMN IF NOT EXISTS viewer_token_created_at TIMESTAMP WITH TIME ZONE;
  `)

    await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_viewer_token_idx
      ON users(viewer_token)
      WHERE viewer_token IS NOT NULL;
  `)

    await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_viewer_token_hash_idx
      ON users(viewer_token_hash)
      WHERE viewer_token_hash IS NOT NULL;
  `)
}

async function ensureLeaderboardColumnsExist() {
    await query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS leaderboard_show_name BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS leaderboard_nickname TEXT,
      ADD COLUMN IF NOT EXISTS leaderboard_color TEXT;
  `)
}

export async function ensureUserTableExists() {
    const tableExists = await query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'users'
    );
  `)

    if (tableExists.rows[0].exists) {
        await query(`
      ALTER TABLE users 
        ALTER COLUMN balance TYPE DECIMAL(16,4);
    `)

        const columnExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'created_at'
      );
    `)

        if (!columnExists.rows[0].exists) {
            await query(`
        ALTER TABLE users 
          ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      `)
        }

        const deletedColumnExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'deleted'
      );
    `)

        if (!deletedColumnExists.rows[0].exists) {
            await query(`
        ALTER TABLE users 
          ADD COLUMN deleted BOOLEAN DEFAULT FALSE;
      `)
        }

        await ensureViewerTokenColumnsExist()
        await ensureLeaderboardColumnsExist()
    } else {
        await query(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        balance DECIMAL(16,4) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        deleted BOOLEAN DEFAULT FALSE,
        leaderboard_show_name BOOLEAN DEFAULT FALSE,
        leaderboard_nickname TEXT,
        leaderboard_color TEXT
      );
    `)

        await query(`
      CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
    `)

        await ensureViewerTokenColumnsExist()
        await ensureLeaderboardColumnsExist()
    }
}

export async function getOrCreateUser(userData: CreateUserInput) {
    await ensureUserTableExists()

    const result = await query(
        `
    INSERT INTO users (id, email, name, role, balance)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE
      SET email = $2, name = $3
      RETURNING *`,
        [
            userData.id,
            userData.email,
            userData.name,
            userData.role || 'user',
            process.env.INIT_BALANCE || '0',
        ]
    )

    return result.rows[0]
}

export async function updateUserBalance(
    userId: string,
    cost: number
): Promise<number> {
    await ensureUserTableExists()

    if (cost > 999999.9999) {
        throw new Error('Balance exceeds maximum allowed value')
    }

    const result = await query(
        `
    UPDATE users 
      SET balance = LEAST(
        CAST($2 AS DECIMAL(16,4)),
        999999.9999
      )
      WHERE id = $1
      RETURNING balance`,
        [userId, cost]
    )

    if (result.rows.length === 0) {
        throw new Error('User not found')
    }

    return Number(result.rows[0].balance)
}

async function ensureDeletedColumnExists() {
    const deletedColumnExists = await query(`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'deleted'
    );
  `)

    if (!deletedColumnExists.rows[0].exists) {
        await query(`
      ALTER TABLE users 
        ADD COLUMN deleted BOOLEAN DEFAULT FALSE;
    `)
    }
}

export async function deleteUser(userId: string) {
    await ensureDeletedColumnExists()

    const updateResult = await query(
        `
    UPDATE users 
      SET deleted = TRUE 
      WHERE id = $1`,
        [userId]
    )

    console.log(`User with ID ${userId} marked as deleted.`, updateResult)
}

interface GetUsersOptions {
    page?: number
    pageSize?: number
    sortField?: string | null
    sortOrder?: string | null
    search?: string | null
}

export async function getUsers({
    page = 1,
    pageSize = 20,
    sortField = null,
    sortOrder = null,
    search = null,
}: GetUsersOptions = {}) {
    await ensureDeletedColumnExists()

    const offset = (page - 1) * pageSize

    let whereClause = 'deleted = FALSE'
    const queryParams: Array<string | number> = []

    if (search) {
        queryParams.push(`%${search}%`, `%${search}%`)
        whereClause += `
      AND (
        name ILIKE $${queryParams.length - 1} OR 
        email ILIKE $${queryParams.length}
      )`
    }

    const countResult = await query(
        `SELECT COUNT(*) FROM users WHERE ${whereClause}`,
        search ? queryParams : []
    )
    const total = parseInt(countResult.rows[0].count)

    let orderClause = 'created_at DESC'
    if (search) {
        orderClause = `
      CASE 
        WHEN name ILIKE $${queryParams.length + 1} THEN 1
        WHEN name ILIKE $${queryParams.length + 2} THEN 2
        WHEN email ILIKE $${queryParams.length + 3} THEN 3
        ELSE 4
      END`
        queryParams.push(`${search}%`, `%${search}%`, `%${search}%`)
    } else if (sortField && sortOrder) {
        const allowedFields = ['balance', 'name', 'email', 'role']
        if (allowedFields.includes(sortField)) {
            orderClause = `${sortField} ${sortOrder === 'ascend' ? 'ASC' : 'DESC'}`
        }
    }

    queryParams.push(pageSize, offset)
    const result = await query(
        `
    SELECT id, email, name, role, balance, deleted
      FROM users
      WHERE ${whereClause}
      ORDER BY ${orderClause}
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
        queryParams
    )

    return {
        users: result.rows,
        total,
    }
}

export async function getAllUsers(includeDeleted: boolean = false) {
    const whereClause = includeDeleted
        ? ''
        : 'WHERE (deleted = FALSE OR deleted IS NULL)'

    const result = await query(`
    SELECT id, email, name, role, balance, deleted
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
  `)

    return result.rows
}

export async function issueUserViewerToken(userId: string) {
    await ensureUserTableExists()

    const token = generateViewerToken()
    const tokenHash = hashViewerToken(token)

    const result = await query(
        `
      UPDATE users
        SET viewer_token = $2,
            viewer_token_hash = $3,
            viewer_token_created_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND deleted = FALSE
        RETURNING id, email, name, role, balance, viewer_token
    `,
        [userId, token, tokenHash]
    )

    if (result.rows.length === 0) {
        throw new Error('User not found')
    }

    return {
        token,
        user: result.rows[0],
    }
}

export async function getOrCreateUserViewerToken(userId: string) {
    await ensureUserTableExists()

    const existingResult = await query(
        `
      SELECT id, email, name, role, balance, viewer_token
      FROM users
      WHERE id = $1
        AND deleted = FALSE
      LIMIT 1
    `,
        [userId]
    )

    if (existingResult.rows.length === 0) {
        throw new Error('User not found')
    }

    const existingUser = existingResult.rows[0]
    if (existingUser.viewer_token) {
        return {
            token: existingUser.viewer_token,
            user: existingUser,
        }
    }

    return issueUserViewerToken(userId)
}

export async function getUserByViewerToken(
    token: string
): Promise<User | null> {
    await ensureUserTableExists()

    const result = await query(
        `
      SELECT id, email, name, role, balance, deleted, viewer_token,
        COALESCE(viewer_token IS NOT NULL, viewer_token_hash IS NOT NULL) AS has_viewer_token
      FROM users
      WHERE (viewer_token = $1 OR viewer_token_hash = $2)
        AND deleted = FALSE
      LIMIT 1
    `,
        [token, hashViewerToken(token)]
    )

    return result.rows[0] || null
}

export async function updateUserLeaderboardPreferences(
    userId: string,
    input: {
        showNameOnLeaderboard: boolean
        leaderboardNickname: string | null
        leaderboardColor: string
    }
) {
    await ensureUserTableExists()

    const result = await query(
        `
      UPDATE users
      SET leaderboard_show_name = $2,
          leaderboard_nickname = $3,
          leaderboard_color = $4
      WHERE id = $1
        AND deleted = FALSE
      RETURNING COALESCE(leaderboard_show_name, FALSE) AS leaderboard_show_name,
                leaderboard_nickname,
                leaderboard_color
    `,
        [
            userId,
            input.showNameOnLeaderboard,
            input.leaderboardNickname,
            input.leaderboardColor,
        ]
    )

    if (result.rows.length === 0) {
        throw new Error('User not found')
    }

    return {
        showNameOnLeaderboard: Boolean(result.rows[0].leaderboard_show_name),
        leaderboardNickname: result.rows[0].leaderboard_nickname || null,
        leaderboardColor:
            result.rows[0].leaderboard_color || DEFAULT_LEADERBOARD_BAR_COLOR,
    }
}

export async function getUserPortalStats(
    userId: string
): Promise<UserPortalStats | null> {
    await ensureUserTableExists()

    const [
        userResult,
        overviewResult,
        recentWindowResult,
        topModelsResult,
        recordsResult,
    ] = await Promise.all([
        query(
            `
          SELECT id,
                 email,
                 name,
                 role,
                 balance,
                 viewer_token,
                 created_at,
                 COALESCE(leaderboard_show_name, FALSE) AS leaderboard_show_name,
                 leaderboard_nickname,
                 leaderboard_color
          FROM users
          WHERE id = $1 AND deleted = FALSE
          LIMIT 1
        `,
            [userId]
        ),
        query(
            `
          SELECT
            COALESCE(SUM(cost), 0) AS total_cost,
            COUNT(*) AS total_calls,
            COALESCE(SUM(input_tokens + output_tokens), 0) AS total_tokens,
            MIN(use_time) AS first_use_time,
            MAX(use_time) AS last_use_time
          FROM user_usage_records
          WHERE user_id = $1
        `,
            [userId]
        ),
        query(
            `
          SELECT
            COALESCE(SUM(cost), 0) AS total_cost,
            COUNT(*) AS total_calls,
            COALESCE(SUM(input_tokens + output_tokens), 0) AS total_tokens
          FROM user_usage_records
          WHERE user_id = $1
            AND use_time >= NOW() - INTERVAL '30 days'
        `,
            [userId]
        ),
        query(
            `
          SELECT
            COALESCE(mp.name, u.model_name) as display_name,
            COALESCE(SUM(u.cost), 0) AS total_cost,
            COUNT(*) AS total_calls,
            COALESCE(SUM(u.input_tokens + u.output_tokens), 0) AS total_tokens
          FROM user_usage_records u
          LEFT JOIN model_prices mp ON u.model_name = mp.id
          WHERE u.user_id = $1
          GROUP BY COALESCE(mp.name, u.model_name)
          ORDER BY total_cost DESC, total_calls DESC
          LIMIT 5
        `,
            [userId]
        ),
        query(
            `
          SELECT
            u.id,
            u.use_time,
            u.model_name,
            COALESCE(mp.name, u.model_name) as display_name,
            u.input_tokens,
            u.output_tokens,
            u.cost,
            u.balance_after
          FROM user_usage_records u
          LEFT JOIN model_prices mp ON u.model_name = mp.id
          WHERE u.user_id = $1
          ORDER BY u.use_time DESC
          LIMIT 10
        `,
            [userId]
        ),
    ])

    if (userResult.rows.length === 0) {
        return null
    }

    const overview = overviewResult.rows[0]
    const recentWindow = recentWindowResult.rows[0]
    const totalCalls = parseInt(overview.total_calls || '0')
    const totalCost = parseFloat(overview.total_cost || '0')

    return {
        profile: {
            id: userResult.rows[0].id,
            email: userResult.rows[0].email,
            name: userResult.rows[0].name,
            role: userResult.rows[0].role,
            balance: parseFloat(userResult.rows[0].balance),
            viewerToken: userResult.rows[0].viewer_token || null,
            createdAt: userResult.rows[0].created_at || null,
            showNameOnLeaderboard: Boolean(
                userResult.rows[0].leaderboard_show_name
            ),
            leaderboardNickname:
                userResult.rows[0].leaderboard_nickname || null,
            leaderboardColor:
                userResult.rows[0].leaderboard_color ||
                DEFAULT_LEADERBOARD_BAR_COLOR,
        },
        overview: {
            totalCost,
            totalCalls,
            totalTokens: parseInt(overview.total_tokens || '0'),
            averageCost: totalCalls > 0 ? totalCost / totalCalls : 0,
            firstUseTime: overview.first_use_time,
            lastUseTime: overview.last_use_time,
        },
        recentWindow: {
            totalCost: parseFloat(recentWindow.total_cost || '0'),
            totalCalls: parseInt(recentWindow.total_calls || '0'),
            totalTokens: parseInt(recentWindow.total_tokens || '0'),
        },
        topModels: topModelsResult.rows.map((row) => ({
            modelName: row.display_name || row.model_name,
            totalCost: parseFloat(row.total_cost),
            totalCalls: parseInt(row.total_calls),
            totalTokens: parseInt(row.total_tokens),
        })),
        recentRecords: recordsResult.rows.map((row) => ({
            id: row.id,
            useTime: row.use_time,
            modelName: row.display_name || row.model_name,
            inputTokens: row.input_tokens,
            outputTokens: row.output_tokens,
            totalTokens: row.input_tokens + row.output_tokens,
            cost: parseFloat(row.cost),
            balanceAfter: parseFloat(row.balance_after),
        })),
    }
}

export async function getUserPortalStatsForTimeRange(
    userId: string,
    days?: number,
    page = 1,
    pageSize = 10,
    timeZone = 'UTC'
): Promise<{
    totalCalls: number
    totalTokens: number
    totalCost: number
    averageCost: number
    dailyUsage: Array<{
        date: string
        totalCost: number
        totalTokens: number
        totalCalls: number
        models: Array<{
            name: string
            cost: number
            tokens: number
            calls: number
        }>
    }>
    topModels: Array<{
        modelName: string
        totalCost: number
        totalCalls: number
    }>
    recentRecords: Array<{
        id: number
        useTime: string
        modelName: string
        totalTokens: number
        cost: number
        balanceAfter: number
    }>
    recentRecordsPagination: {
        page: number
        pageSize: number
        total: number
        totalPages: number
    }
}> {
    await ensureUserTableExists()

    const safePage = Math.max(1, Math.floor(page))
    const safePageSize = Math.min(Math.max(1, Math.floor(pageSize)), 100)
    const offset = (safePage - 1) * safePageSize

    const statsParams = days ? [userId, timeZone, days] : [userId]
    const statsTimeCondition = days
        ? `AND DATE(use_time AT TIME ZONE $2) >= DATE(NOW() AT TIME ZONE $2) - ($3::integer - 1)`
        : ''

    const dailyUsageParams = days
        ? [userId, timeZone, days]
        : [userId, timeZone]
    const dailyUsageTimeCondition = days
        ? `AND DATE(u.use_time AT TIME ZONE $2) >= DATE(NOW() AT TIME ZONE $2) - ($3::integer - 1)`
        : ''

    const topModelsParams = days ? [userId, timeZone, days] : [userId]
    const topModelsTimeCondition = days
        ? `AND DATE(u.use_time AT TIME ZONE $2) >= DATE(NOW() AT TIME ZONE $2) - ($3::integer - 1)`
        : ''

    const recordsCountParams = days ? [userId, timeZone, days] : [userId]
    const recordsCountTimeCondition = days
        ? `AND DATE(u.use_time AT TIME ZONE $2) >= DATE(NOW() AT TIME ZONE $2) - ($3::integer - 1)`
        : ''

    const recordsParams = days
        ? [userId, safePageSize, offset, timeZone, days]
        : [userId, safePageSize, offset]
    const recordsTimeCondition = days
        ? `AND DATE(u.use_time AT TIME ZONE $4) >= DATE(NOW() AT TIME ZONE $4) - ($5::integer - 1)`
        : ''

    const [
        statsResult,
        dailyUsageResult,
        topModelsResult,
        recordsCountResult,
        recordsResult,
    ] = await Promise.all([
        query(
            `
          SELECT
            COALESCE(SUM(cost), 0) AS total_cost,
            COUNT(*) AS total_calls,
            COALESCE(SUM(input_tokens + output_tokens), 0) AS total_tokens
          FROM user_usage_records
          WHERE user_id = $1
          ${statsTimeCondition}
        `,
            statsParams
        ),
        query(
            `
          SELECT
            DATE(u.use_time AT TIME ZONE $2) as date,
            COALESCE(mp.name, u.model_name) as display_name,
            COALESCE(SUM(u.cost), 0) AS total_cost,
            COALESCE(SUM(u.input_tokens + u.output_tokens), 0) AS total_tokens,
            COUNT(*) AS total_calls
          FROM user_usage_records u
          LEFT JOIN model_prices mp ON u.model_name = mp.id
          WHERE u.user_id = $1
          ${dailyUsageTimeCondition}
          GROUP BY DATE(u.use_time AT TIME ZONE $2), COALESCE(mp.name, u.model_name)
          ORDER BY DATE(u.use_time AT TIME ZONE $2) ASC, total_cost DESC
        `,
            dailyUsageParams
        ),
        query(
            `
          SELECT
            COALESCE(mp.name, u.model_name) as display_name,
            COALESCE(SUM(u.cost), 0) AS total_cost,
            COUNT(*) AS total_calls
          FROM user_usage_records u
          LEFT JOIN model_prices mp ON u.model_name = mp.id
          WHERE u.user_id = $1
          ${topModelsTimeCondition}
          GROUP BY COALESCE(mp.name, u.model_name)
          ORDER BY total_cost DESC, total_calls DESC
          LIMIT 500
        `,
            topModelsParams
        ),
        query(
            `
          SELECT COUNT(*) AS total
          FROM user_usage_records u
          WHERE u.user_id = $1
          ${recordsCountTimeCondition}
        `,
            recordsCountParams
        ),
        query(
            `
          SELECT
            u.id,
            u.use_time,
            u.model_name,
            COALESCE(mp.name, u.model_name) as display_name,
            u.input_tokens,
            u.output_tokens,
            u.cost,
            u.balance_after
          FROM user_usage_records u
          LEFT JOIN model_prices mp ON u.model_name = mp.id
          WHERE u.user_id = $1
          ${recordsTimeCondition}
          ORDER BY u.use_time DESC
          LIMIT $2 OFFSET $3
        `,
            recordsParams
        ),
    ])

    const stats = statsResult.rows[0]
    const totalCalls = parseInt(stats.total_calls || '0')
    const totalCost = parseFloat(stats.total_cost || '0')
    const recentRecordsTotal = parseInt(recordsCountResult.rows[0].total || '0')
    const recentRecordsTotalPages =
        recentRecordsTotal > 0
            ? Math.ceil(recentRecordsTotal / safePageSize)
            : 1

    // Group daily usage by date and process models
    const dailyUsageMap = new Map<
        string,
        {
            date: string
            totalCost: number
            totalTokens: number
            totalCalls: number
            models: Map<
                string,
                { name: string; cost: number; tokens: number; calls: number }
            >
        }
    >()

    for (const row of dailyUsageResult.rows) {
        const date =
            row.date instanceof Date
                ? row.date.toISOString().slice(0, 10)
                : String(row.date)
        if (!dailyUsageMap.has(date)) {
            dailyUsageMap.set(date, {
                date,
                totalCost: 0,
                totalTokens: 0,
                totalCalls: 0,
                models: new Map(),
            })
        }
        const day = dailyUsageMap.get(date)!
        day.totalCost += parseFloat(row.total_cost || '0')
        day.totalTokens += parseInt(row.total_tokens || '0')
        day.totalCalls += parseInt(row.total_calls || '0')

        const modelName = row.display_name || row.model_name
        if (!day.models.has(modelName)) {
            day.models.set(modelName, {
                name: modelName,
                cost: 0,
                tokens: 0,
                calls: 0,
            })
        }
        const model = day.models.get(modelName)!
        model.cost += parseFloat(row.total_cost || '0')
        model.tokens += parseInt(row.total_tokens || '0')
        model.calls += parseInt(row.total_calls || '0')
    }

    const dailyUsage = Array.from(dailyUsageMap.values())
        .sort((a, b) => compareDayKeys(a.date, b.date))
        .map((day) => ({
            date: day.date,
            totalCost: day.totalCost,
            totalTokens: day.totalTokens,
            totalCalls: day.totalCalls,
            models: Array.from(day.models.values()).sort(
                (a, b) => b.cost - a.cost
            ),
        }))

    return {
        totalCalls,
        totalTokens: parseInt(stats.total_tokens || '0'),
        totalCost,
        averageCost: totalCalls > 0 ? totalCost / totalCalls : 0,
        dailyUsage,
        topModels: topModelsResult.rows.map((row) => ({
            modelName: row.display_name || row.model_name,
            totalCost: parseFloat(row.total_cost),
            totalCalls: parseInt(row.total_calls),
        })),
        recentRecords: recordsResult.rows.map((row) => ({
            id: row.id,
            useTime: row.use_time,
            modelName: row.display_name || row.model_name,
            totalTokens: row.input_tokens + row.output_tokens,
            cost: parseFloat(row.cost),
            balanceAfter: parseFloat(row.balance_after),
        })),
        recentRecordsPagination: {
            page: safePage,
            pageSize: safePageSize,
            total: recentRecordsTotal,
            totalPages: recentRecordsTotalPages,
        },
    }
}

export async function getMostExpensiveCall(
    days?: number
): Promise<MostExpensiveCall | null> {
    await ensureUserTableExists()

    const queryParams: number[] = []
    const timeCondition = days
        ? `AND r.use_time >= NOW() - ($1 * INTERVAL '1 day')`
        : ''

    if (days) {
        queryParams.push(days)
    }

    const result = await query(
        `
      SELECT
        r.user_id,
        u.name,
        COALESCE(u.leaderboard_show_name, FALSE) AS leaderboard_show_name,
        NULLIF(BTRIM(u.leaderboard_nickname), '') AS leaderboard_nickname,
        COALESCE(mp.name, r.model_name) AS model_name,
        r.input_tokens,
        r.output_tokens,
        r.cost,
        r.use_time
      FROM user_usage_records r
      INNER JOIN users u ON u.id = r.user_id
      LEFT JOIN model_prices mp ON r.model_name = mp.id
      WHERE (u.deleted = FALSE OR u.deleted IS NULL)
      ${timeCondition}
      ORDER BY r.cost DESC
      LIMIT 1
    `,
        queryParams
    )

    if (result.rows.length === 0) {
        return null
    }

    const row = result.rows[0]
    const isAnonymous = !row.leaderboard_show_name

    return {
        userId: row.user_id,
        displayName: isAnonymous
            ? 'Anonymous'
            : row.leaderboard_nickname || row.name,
        isAnonymous,
        modelName: row.model_name,
        inputTokens: parseInt(row.input_tokens || '0'),
        outputTokens: parseInt(row.output_tokens || '0'),
        totalTokens:
            parseInt(row.input_tokens || '0') +
            parseInt(row.output_tokens || '0'),
        cost: parseFloat(row.cost || '0'),
        useTime: row.use_time,
    }
}

export async function getLeaderboardStats(
    days?: number,
    page = 1,
    pageSize = 10,
    timeZone = 'UTC'
): Promise<LeaderboardStats> {
    await ensureUserTableExists()

    const safePage = Math.max(1, Math.floor(page))
    const safePageSize = Math.min(Math.max(1, Math.floor(pageSize)), 100)
    const offset = (safePage - 1) * safePageSize
    const queryParams: number[] = []
    const timeCondition = days
        ? `AND r.use_time >= NOW() - ($1 * INTERVAL '1 day')`
        : ''
    const recordsParams = days
        ? [days, safePageSize, offset]
        : [safePageSize, offset]
    const recordsTimeCondition = days
        ? `AND r.use_time >= NOW() - ($1 * INTERVAL '1 day')`
        : ''
    const recordsLimitOffset = days
        ? 'LIMIT $2 OFFSET $3'
        : 'LIMIT $1 OFFSET $2'
    const dailyUsageParams = days ? [timeZone, days] : [timeZone]
    const dailyUsageTimeCondition = days
        ? `AND DATE(r.use_time AT TIME ZONE $1) >= DATE(NOW() AT TIME ZONE $1) - ($2::integer - 1)`
        : ''
    const contributionDailyUsageParams = [timeZone]

    if (days) {
        queryParams.push(days)
    }

    const [
        statsResult,
        dailyUsageResult,
        contributionDailyUsageResult,
        usersResult,
        topModelsResult,
        recordsCountResult,
        recordsResult,
        mostExpensiveCall,
    ] = await Promise.all([
        query(
            `
          SELECT
            COALESCE(SUM(r.cost), 0) AS total_cost,
            COUNT(*) AS total_calls,
            COALESCE(SUM(r.input_tokens + r.output_tokens), 0) AS total_tokens,
            MIN(r.use_time) AS first_use_time,
            MAX(r.use_time) AS last_use_time
          FROM user_usage_records r
          INNER JOIN users u ON u.id = r.user_id
          WHERE (u.deleted = FALSE OR u.deleted IS NULL)
          ${timeCondition}
        `,
            queryParams
        ),
        query(
            `
          SELECT
            DATE(r.use_time AT TIME ZONE $1) AS date,
            COALESCE(mp.name, r.model_name) AS display_name,
            COALESCE(SUM(r.cost), 0) AS total_cost,
            COALESCE(SUM(r.input_tokens + r.output_tokens), 0) AS total_tokens,
            COUNT(*) AS total_calls
          FROM user_usage_records r
          INNER JOIN users u ON u.id = r.user_id
          LEFT JOIN model_prices mp ON r.model_name = mp.id
          WHERE (u.deleted = FALSE OR u.deleted IS NULL)
          ${dailyUsageTimeCondition}
          GROUP BY DATE(r.use_time AT TIME ZONE $1), COALESCE(mp.name, r.model_name)
          ORDER BY DATE(r.use_time AT TIME ZONE $1) ASC, total_cost DESC
        `,
            dailyUsageParams
        ),
        query(
            `
          SELECT
            DATE(r.use_time AT TIME ZONE $1) AS date,
            COALESCE(mp.name, r.model_name) AS display_name,
            COALESCE(SUM(r.cost), 0) AS total_cost,
            COALESCE(SUM(r.input_tokens + r.output_tokens), 0) AS total_tokens,
            COUNT(*) AS total_calls
          FROM user_usage_records r
          INNER JOIN users u ON u.id = r.user_id
          LEFT JOIN model_prices mp ON r.model_name = mp.id
          WHERE (u.deleted = FALSE OR u.deleted IS NULL)
            AND DATE(r.use_time AT TIME ZONE $1) >= DATE(NOW() AT TIME ZONE $1) - 364
          GROUP BY DATE(r.use_time AT TIME ZONE $1), COALESCE(mp.name, r.model_name)
          ORDER BY DATE(r.use_time AT TIME ZONE $1) ASC, total_cost DESC
        `,
            contributionDailyUsageParams
        ),
        query(
            `
          SELECT
            u.id,
            u.name,
            COALESCE(u.leaderboard_show_name, FALSE) AS leaderboard_show_name,
            NULLIF(BTRIM(u.leaderboard_nickname), '') AS leaderboard_nickname,
            u.leaderboard_color,
            COUNT(*) AS total_calls,
            COALESCE(SUM(r.input_tokens + r.output_tokens), 0) AS total_tokens,
            COALESCE(SUM(r.cost), 0) AS total_cost
          FROM user_usage_records r
          INNER JOIN users u ON u.id = r.user_id
          WHERE (u.deleted = FALSE OR u.deleted IS NULL)
          ${timeCondition}
          GROUP BY u.id, u.name, u.leaderboard_show_name, u.leaderboard_nickname, u.leaderboard_color
          ORDER BY total_cost DESC, total_calls DESC, u.name ASC
        `,
            queryParams
        ),
        query(
            `
          SELECT
            COALESCE(mp.name, r.model_name) AS display_name,
            COALESCE(SUM(r.cost), 0) AS total_cost,
            COUNT(*) AS total_calls
          FROM user_usage_records r
          INNER JOIN users u ON u.id = r.user_id
          LEFT JOIN model_prices mp ON r.model_name = mp.id
          WHERE (u.deleted = FALSE OR u.deleted IS NULL)
          ${timeCondition}
          GROUP BY COALESCE(mp.name, r.model_name)
          ORDER BY total_cost DESC, total_calls DESC
          LIMIT 500
        `,
            queryParams
        ),
        query(
            `
          SELECT COUNT(*) AS total
          FROM user_usage_records r
          INNER JOIN users u ON u.id = r.user_id
          WHERE (u.deleted = FALSE OR u.deleted IS NULL)
          ${timeCondition}
        `,
            queryParams
        ),
        query(
            `
          SELECT
            r.id,
            r.use_time,
            COALESCE(mp.name, r.model_name) AS model_name,
            r.input_tokens,
            r.output_tokens,
            r.cost,
            r.balance_after,
            u.name,
            COALESCE(u.leaderboard_show_name, FALSE) AS leaderboard_show_name,
            NULLIF(BTRIM(u.leaderboard_nickname), '') AS leaderboard_nickname
          FROM user_usage_records r
          INNER JOIN users u ON u.id = r.user_id
          LEFT JOIN model_prices mp ON r.model_name = mp.id
          WHERE (u.deleted = FALSE OR u.deleted IS NULL)
          ${recordsTimeCondition}
          ORDER BY r.use_time DESC
          ${recordsLimitOffset}
        `,
            recordsParams
        ),
        getMostExpensiveCall(days),
    ])

    const stats = statsResult.rows[0]
    const totalCalls = parseInt(stats.total_calls || '0')
    const totalCost = parseFloat(stats.total_cost || '0')
    const recentRecordsTotal = parseInt(recordsCountResult.rows[0].total || '0')
    const recentRecordsTotalPages =
        recentRecordsTotal > 0
            ? Math.ceil(recentRecordsTotal / safePageSize)
            : 1
    const buildDailyUsage = (
        rows: Array<{
            date: Date | string
            display_name?: string
            model_name?: string
            total_cost?: string
            total_tokens?: string
            total_calls?: string
        }>
    ) => {
        const dailyUsageMap = new Map<
            string,
            {
                date: string
                totalCost: number
                totalTokens: number
                totalCalls: number
                models: Map<
                    string,
                    {
                        name: string
                        cost: number
                        tokens: number
                        calls: number
                    }
                >
            }
        >()

        for (const row of rows) {
            const date =
                row.date instanceof Date
                    ? row.date.toISOString().slice(0, 10)
                    : String(row.date)
            if (!dailyUsageMap.has(date)) {
                dailyUsageMap.set(date, {
                    date,
                    totalCost: 0,
                    totalTokens: 0,
                    totalCalls: 0,
                    models: new Map(),
                })
            }

            const day = dailyUsageMap.get(date)!
            const cost = parseFloat(row.total_cost || '0')
            const tokens = parseInt(row.total_tokens || '0')
            const calls = parseInt(row.total_calls || '0')
            const modelName = row.display_name || row.model_name || 'Unknown'

            day.totalCost += cost
            day.totalTokens += tokens
            day.totalCalls += calls

            if (!day.models.has(modelName)) {
                day.models.set(modelName, {
                    name: modelName,
                    cost: 0,
                    tokens: 0,
                    calls: 0,
                })
            }

            const model = day.models.get(modelName)!
            model.cost += cost
            model.tokens += tokens
            model.calls += calls
        }

        return Array.from(dailyUsageMap.values())
            .sort((a, b) => compareDayKeys(a.date, b.date))
            .map((day) => ({
                date: day.date,
                totalCost: day.totalCost,
                totalTokens: day.totalTokens,
                totalCalls: day.totalCalls,
                models: Array.from(day.models.values()).sort(
                    (a, b) => b.cost - a.cost
                ),
            }))
    }

    return {
        totalCalls,
        totalTokens: parseInt(stats.total_tokens || '0'),
        totalCost,
        averageCost: totalCalls > 0 ? totalCost / totalCalls : 0,
        firstUseTime: stats.first_use_time,
        lastUseTime: stats.last_use_time,
        users: usersResult.rows.map((row) => {
            const totalUserCalls = parseInt(row.total_calls || '0')
            const totalUserCost = parseFloat(row.total_cost || '0')
            const isAnonymous = !row.leaderboard_show_name
            const leaderboardColor = LEADERBOARD_BAR_COLORS.includes(
                row.leaderboard_color as (typeof LEADERBOARD_BAR_COLORS)[number]
            )
                ? row.leaderboard_color
                : DEFAULT_LEADERBOARD_BAR_COLOR

            return {
                userId: row.id,
                displayName: isAnonymous
                    ? 'Anonymous'
                    : row.leaderboard_nickname || row.name,
                isAnonymous,
                leaderboardColor,
                totalCalls: totalUserCalls,
                totalTokens: parseInt(row.total_tokens || '0'),
                totalCost: totalUserCost,
                averageCost:
                    totalUserCalls > 0 ? totalUserCost / totalUserCalls : 0,
            }
        }),
        dailyUsage: buildDailyUsage(dailyUsageResult.rows),
        contributionDailyUsage: buildDailyUsage(contributionDailyUsageResult.rows),
        topModels: topModelsResult.rows.map((row) => ({
            modelName: row.display_name || row.model_name,
            totalCost: parseFloat(row.total_cost || '0'),
            totalCalls: parseInt(row.total_calls || '0'),
        })),
        recentRecords: recordsResult.rows.map((row) => {
            const isAnonymous = !row.leaderboard_show_name

            return {
                id: row.id,
                useTime: row.use_time,
                modelName: row.model_name,
                totalTokens:
                    parseInt(row.input_tokens || '0') +
                    parseInt(row.output_tokens || '0'),
                cost: parseFloat(row.cost || '0'),
                balanceAfter: parseFloat(row.balance_after || '0'),
                displayName: isAnonymous
                    ? 'Anonymous'
                    : row.leaderboard_nickname || row.name,
                isAnonymous,
            }
        }),
        recentRecordsPagination: {
            page: safePage,
            pageSize: safePageSize,
            total: recentRecordsTotal,
            totalPages: recentRecordsTotalPages,
        },
        mostExpensiveCall,
    }
}
