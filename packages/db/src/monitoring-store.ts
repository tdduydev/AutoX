// ============================================================
// MongoDB-backed Monitoring Store
// ============================================================

import type { Filter } from 'mongodb';
import { auditLogsCollection, systemLogsCollection } from './mongo.js';
import type { MongoAuditLog, MongoSystemLog } from './mongo.js';

export interface AuditLogFilter {
  tenantId?: string;
  userId?: string;
  action?: string;
  resource?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface SystemLogFilter {
  level?: string | string[];
  source?: string;
  search?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

function buildAuditFilter(filter: AuditLogFilter): Filter<MongoAuditLog> {
  const q: Filter<MongoAuditLog> = {};
  if (filter.tenantId) q.tenantId = filter.tenantId;
  if (filter.userId) q.userId = filter.userId;
  if (filter.action) q.action = filter.action;
  if (filter.resource) q.resource = filter.resource;
  if (filter.from || filter.to) {
    q.createdAt = {};
    if (filter.from) (q.createdAt as any).$gte = filter.from;
    if (filter.to) (q.createdAt as any).$lte = filter.to;
  }
  return q;
}

function buildSystemFilter(filter: SystemLogFilter): Filter<MongoSystemLog> {
  const q: Filter<MongoSystemLog> = {};
  if (filter.level) {
    q.level = Array.isArray(filter.level) ? { $in: filter.level } : filter.level;
  }
  if (filter.source) q.source = filter.source;
  if (filter.search) q.$text = { $search: filter.search };
  if (filter.from || filter.to) {
    q.createdAt = {};
    if (filter.from) (q.createdAt as any).$gte = filter.from;
    if (filter.to) (q.createdAt as any).$lte = filter.to;
  }
  return q;
}

export const mongoMonitoringStore = {
  async writeAuditLog(entry: MongoAuditLog): Promise<void> {
    await auditLogsCollection().insertOne(entry as any);
  },

  async writeSystemLog(entry: MongoSystemLog): Promise<void> {
    await systemLogsCollection().insertOne(entry as any);
  },

  async queryAuditLogs(filter: AuditLogFilter): Promise<MongoAuditLog[]> {
    const q = buildAuditFilter(filter);
    return auditLogsCollection()
      .find(q)
      .sort({ createdAt: -1 })
      .skip(filter.offset ?? 0)
      .limit(filter.limit ?? 50)
      .toArray();
  },

  async querySystemLogs(filter: SystemLogFilter): Promise<MongoSystemLog[]> {
    const q = buildSystemFilter(filter);
    return systemLogsCollection()
      .find(q)
      .sort({ createdAt: -1 })
      .skip(filter.offset ?? 0)
      .limit(filter.limit ?? 100)
      .toArray();
  },

  async countAuditLogs(filter: AuditLogFilter): Promise<number> {
    return auditLogsCollection().countDocuments(buildAuditFilter(filter));
  },

  async countSystemLogs(filter: SystemLogFilter): Promise<number> {
    return systemLogsCollection().countDocuments(buildSystemFilter(filter));
  },
};
