// =============================================================================
// drizzleBridge.js · Compatibility layer mapping Prisma API to Drizzle ORM (MySQL 8)
// Provides full Drizzle ORM access alongside existing model query methods
// =============================================================================
import {
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  inArray,
  notInArray,
  like,
  isNull,
  isNotNull,
  and,
  or,
  not,
  sql,
  desc,
  asc,
  count,
  getTableUniqueName
} from 'drizzle-orm';
import * as schema from '../../drizzle/schema.js';
import { randomUUID } from 'node:crypto';

export const MODEL_MAP = {
  department: { table: schema.departments, queryKey: 'departments', pk: 'id' },
  grade: { table: schema.grades, queryKey: 'grades', pk: 'id' },
  location: { table: schema.locations, queryKey: 'locations', pk: 'id' },
  station: { table: schema.stations, queryKey: 'stations', pk: 'id' },
  gradeSupervisoryMapping: { table: schema.gradeSupervisoryMappings, queryKey: 'gradeSupervisoryMappings', pk: 'id' },
  staffRecord: { table: schema.staffRecords, queryKey: 'staffRecords', pk: 'id' },
  staffPlacementHistory: { table: schema.staffPlacementHistories, queryKey: 'staffPlacementHistories', pk: 'id' },
  account: { table: schema.accounts, queryKey: 'accounts', pk: 'id' },
  session: { table: schema.sessions, queryKey: 'sessions', pk: 'id' },
  loginAttempt: { table: schema.loginAttempts, queryKey: 'loginAttempts', pk: 'id' },
  accountRole: { table: schema.accountRoles, queryKey: 'accountRoles', pk: ['accountId', 'role'] },
  accountPermission: { table: schema.accountPermissions, queryKey: 'accountPermissions', pk: ['accountId', 'key'] },
  accountScopeDepartment: { table: schema.accountScopeDepartments, queryKey: 'accountScopeDepartments', pk: ['accountId', 'departmentId'] },
  supervisorAssignment: { table: schema.supervisorAssignments, queryKey: 'supervisorAssignments', pk: 'id' },
  competencyCategory: { table: schema.competencyCategories, queryKey: 'competencyCategories', pk: 'id' },
  competency: { table: schema.competencies, queryKey: 'competencies', pk: 'id' },
  assessment: { table: schema.assessments, queryKey: 'assessments', pk: 'id' },
  assessmentVersion: { table: schema.assessmentVersions, queryKey: 'assessmentVersions', pk: 'id' },
  assessmentReviewEvent: { table: schema.assessmentReviewEvents, queryKey: 'assessmentReviewEvents', pk: 'id' },
  question: { table: schema.questions, queryKey: 'questions', pk: 'id' },
  answerOption: { table: schema.answerOptions, queryKey: 'answerOptions', pk: 'id' },
  questionCompetency: { table: schema.questionCompetencies, queryKey: 'questionCompetencies', pk: ['questionId', 'competencyId'] },
  assessmentAssignment: { table: schema.assessmentAssignments, queryKey: 'assessmentAssignments', pk: 'id' },
  deadlineExtension: { table: schema.deadlineExtensions, queryKey: 'deadlineExtensions', pk: 'id' },
  attempt: { table: schema.attempts, queryKey: 'attempts', pk: 'id' },
  attemptResponse: { table: schema.attemptResponses, queryKey: 'attemptResponses', pk: 'id' },
  activeTimeSegment: { table: schema.activeTimeSegments, queryKey: 'activeTimeSegments', pk: 'id' },
  competencyAttemptResult: { table: schema.competencyAttemptResults, queryKey: 'competencyAttemptResults', pk: ['attemptId', 'competencyId'] },
  finalCompetencyResult: { table: schema.finalCompetencyResults, queryKey: 'finalCompetencyResults', pk: ['staffId', 'assessmentId', 'competencyId'] },
  scoringConfig: { table: schema.scoringConfigs, queryKey: 'scoringConfigs', pk: 'id' },
  notificationTemplate: { table: schema.notificationTemplates, queryKey: 'notificationTemplates', pk: 'key' },
  notification: { table: schema.notifications, queryKey: 'notifications', pk: 'id' },
  notificationDelivery: { table: schema.notificationDeliveries, queryKey: 'notificationDeliveries', pk: 'id' },
  ticket: { table: schema.tickets, queryKey: 'tickets', pk: 'id' },
  ticketMessage: { table: schema.ticketMessages, queryKey: 'ticketMessages', pk: 'id' },
  ticketAttachment: { table: schema.ticketAttachments, queryKey: 'ticketAttachments', pk: 'id' },
  ticketEvent: { table: schema.ticketEvents, queryKey: 'ticketEvents', pk: 'id' },
  auditLog: { table: schema.auditLogs, queryKey: 'auditLogs', pk: 'id' },
  systemSetting: { table: schema.systemSettings, queryKey: 'systemSettings', pk: 'key' },
};

const RELATION_FILTERS = {
  Account: {
    roles: { targetTable: schema.accountRoles, foreignKey: 'accountId', localKey: 'id' },
    staff: { targetTable: schema.staffRecords, foreignKey: 'id', localKey: 'staffId' },
    permissions: { targetTable: schema.accountPermissions, foreignKey: 'accountId', localKey: 'id' },
    scopeDepartments: { targetTable: schema.accountScopeDepartments, foreignKey: 'accountId', localKey: 'id' },
  },
  StaffRecord: {
    reports: { targetTable: schema.staffRecords, foreignKey: 'supervisorId', localKey: 'id' },
    department: { targetTable: schema.departments, foreignKey: 'id', localKey: 'departmentId' },
    grade: { targetTable: schema.grades, foreignKey: 'id', localKey: 'gradeId' },
    station: { targetTable: schema.stations, foreignKey: 'id', localKey: 'stationId' },
  },
  Assessment: {
    versions: { targetTable: schema.assessmentVersions, foreignKey: 'assessmentId', localKey: 'id' },
    assignments: { targetTable: schema.assessmentAssignments, foreignKey: 'assessmentId', localKey: 'id' },
  },
  AssessmentVersion: {
    questions: { targetTable: schema.questions, foreignKey: 'versionId', localKey: 'id' },
    reviewEvents: { targetTable: schema.assessmentReviewEvents, foreignKey: 'versionId', localKey: 'id' },
  },
  Question: {
    competencies: { targetTable: schema.questionCompetencies, foreignKey: 'questionId', localKey: 'id' },
    options: { targetTable: schema.answerOptions, foreignKey: 'questionId', localKey: 'id' },
  },
  AssessmentAssignment: {
    staff: { targetTable: schema.staffRecords, foreignKey: 'id', localKey: 'staffId' },
    department: { targetTable: schema.departments, foreignKey: 'id', localKey: 'departmentId' },
  },
  Attempt: {
    staff: { targetTable: schema.staffRecords, foreignKey: 'id', localKey: 'staffId' },
    assessment: { targetTable: schema.assessments, foreignKey: 'id', localKey: 'assessmentId' },
  },
  Ticket: {
    requester: { targetTable: schema.accounts, foreignKey: 'id', localKey: 'requesterId' },
    assignee: { targetTable: schema.accounts, foreignKey: 'id', localKey: 'assigneeId' },
  }
};

export function transformInclude(include, queryKey, drizzleDb) {
  if (!include || typeof include !== 'object') return undefined;
  const validRelations = queryKey && drizzleDb?._?.fullSchema?.[queryKey]?.relations;
  const res = {};

  for (const [k, v] of Object.entries(include)) {
    if (k === '_count') continue;
    if (validRelations && !validRelations[k]) continue;

    if (v === true) {
      res[k] = true;
    } else if (typeof v === 'object' && v !== null) {
      let targetQueryKey = undefined;
      if (validRelations && validRelations[k]?.referencedTable) {
        const refTableName = getTableUniqueName(validRelations[k].referencedTable);
        targetQueryKey = drizzleDb?._?.tableNamesMap?.[refTableName];
      }
      const childWith = v.include ? transformInclude(v.include, targetQueryKey, drizzleDb) : undefined;
      const childWhere = v.where && validRelations?.[k]?.referencedTable ? buildWhereConditions(validRelations[k].referencedTable, v.where) : undefined;
      const childOrderBy = v.orderBy && validRelations?.[k]?.referencedTable ? buildOrderBy(validRelations[k].referencedTable, v.orderBy) : undefined;

      const conf = {};
      if (childWith) conf.with = childWith;
      if (childWhere && childWhere.length) conf.where = childWhere.length > 1 ? and(...childWhere) : childWhere[0];
      if (childOrderBy && childOrderBy.length) conf.orderBy = childOrderBy;
      if (v.take != null) conf.limit = v.take;
      if (v.skip != null) conf.offset = v.skip;

      res[k] = Object.keys(conf).length ? conf : true;
    }
  }

  // If include has _count: { select: { relName: true } }, also load relName if it exists so we can calculate count
  if (include?._count && typeof include._count === 'object') {
    const sel = include._count.select || include._count;
    if (typeof sel === 'object') {
      for (const relName of Object.keys(sel)) {
        if (validRelations && validRelations[relName] && !res[relName]) {
          res[relName] = true;
        }
      }
    }
  }

  return Object.keys(res).length ? res : undefined;
}

export function attachCountProxy(data, include) {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map(item => attachCountProxy(item, include));
  }
  if (typeof data !== 'object' || data instanceof Date) return data;

  const countSelect = include?._count?.select || include?._count;
  const counts = {};
  if (countSelect && typeof countSelect === 'object') {
    for (const k of Object.keys(countSelect)) {
      if (Array.isArray(data[k])) {
        counts[k] = data[k].length;
      }
    }
  }

  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v)) {
      const childInclude = include?.[k]?.include;
      data[k] = v.map(item => attachCountProxy(item, childInclude));
    } else if (v && typeof v === 'object' && !(v instanceof Date)) {
      const childInclude = include?.[k]?.include;
      data[k] = attachCountProxy(v, childInclude);
    }
  }

  if (include?._count || !data._count) {
    data._count = new Proxy(counts, {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === '_all') return target._all ?? 0;
        if (Array.isArray(data[prop])) return data[prop].length;
        return 0;
      }
    });
  }
  return data;
}

export function buildWhereConditions(table, where) {
  if (!where || typeof where !== 'object') return [];
  const conds = [];
  const tableName = table[Symbol.for('drizzle:Name')] || table._?.name;
  const relConfig = RELATION_FILTERS[tableName];

  for (const [k, v] of Object.entries(where)) {
    if (k === 'OR' && Array.isArray(v)) {
      const orParts = v.map(sub => {
        const subConds = buildWhereConditions(table, sub);
        return subConds.length > 1 ? and(...subConds) : subConds[0];
      }).filter(Boolean);
      if (orParts.length) conds.push(or(...orParts));
      continue;
    }
    if (k === 'AND' && Array.isArray(v)) {
      const andParts = v.flatMap(sub => buildWhereConditions(table, sub)).filter(Boolean);
      if (andParts.length) conds.push(and(...andParts));
      continue;
    }
    if (k === 'NOT' && v) {
      const notConds = buildWhereConditions(table, v);
      if (notConds.length) conds.push(not(and(...notConds)));
      continue;
    }

    // Check relation filters
    if (relConfig && relConfig[k]) {
      const { targetTable, foreignKey, localKey } = relConfig[k];
      const localCol = table[localKey];
      const targetCol = targetTable[foreignKey];
      const targetSubWhere = (v && typeof v === 'object' && 'some' in v) ? v.some : v;

      if (targetSubWhere && typeof targetSubWhere === 'object') {
        const subConds = buildWhereConditions(targetTable, targetSubWhere);
        if (subConds.length) {
          conds.push(inArray(localCol, sql`(SELECT ${targetCol} FROM ${targetTable} WHERE ${and(...subConds)})`));
        } else {
          conds.push(inArray(localCol, sql`(SELECT ${targetCol} FROM ${targetTable} WHERE ${targetCol} IS NOT NULL)`));
        }
      }
      continue;
    }

    const col = table[k];
    if (!col) continue; // Skip unmapped relation fields

    if (v === null) {
      conds.push(isNull(col));
    } else if (typeof v === 'object' && !(v instanceof Date)) {
      if ('equals' in v) {
        conds.push(v.equals === null ? isNull(col) : eq(col, v.equals));
      }
      if ('not' in v) {
        conds.push(v.not === null ? isNotNull(col) : ne(col, v.not));
      }
      if ('in' in v && Array.isArray(v.in)) {
        if (v.in.length === 0) conds.push(sql`1=0`);
        else conds.push(inArray(col, v.in));
      }
      if ('notIn' in v && Array.isArray(v.notIn)) {
        if (v.notIn.length > 0) conds.push(notInArray(col, v.notIn));
      }
      if ('gt' in v) conds.push(gt(col, v.gt));
      if ('gte' in v) conds.push(gte(col, v.gte));
      if ('lt' in v) conds.push(lt(col, v.lt));
      if ('lte' in v) conds.push(lte(col, v.lte));
      if ('contains' in v) {
        conds.push(like(col, `%${v.contains}%`));
      }
      if ('startsWith' in v) {
        conds.push(like(col, `${v.startsWith}%`));
      }
      if ('endsWith' in v) {
        conds.push(like(col, `%${v.endsWith}`));
      }
    } else {
      conds.push(eq(col, v));
    }
  }

  return conds;
}

export function buildOrderBy(table, orderBy) {
  if (!orderBy) return [];
  const list = Array.isArray(orderBy) ? orderBy : [orderBy];
  const orders = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    for (const [k, dir] of Object.entries(item)) {
      if (typeof dir === 'object') continue; // relation sort
      const col = table[k];
      if (!col) continue;
      orders.push(String(dir).toLowerCase() === 'desc' ? desc(col) : asc(col));
    }
  }
  return orders;
}

export function createModelDelegate(drizzleDb, modelConfig) {
  const { table, queryKey, pk } = modelConfig;

  async function handleNestedRelations(insertedId, data) {
    for (const [field, val] of Object.entries(data)) {
      if (!val || typeof val !== 'object') continue;
      if (val.create) {
        const items = Array.isArray(val.create) ? val.create : [val.create];
        if (field === 'roles') {
          for (const r of items) {
            await drizzleDb.insert(schema.accountRoles).values({ accountId: insertedId, role: r.role });
          }
        } else if (field === 'permissions') {
          for (const p of items) {
            await drizzleDb.insert(schema.accountPermissions).values({ accountId: insertedId, key: p.key || p });
          }
        } else if (field === 'scopeDepartments') {
          for (const s of items) {
            await drizzleDb.insert(schema.accountScopeDepartments).values({ accountId: insertedId, departmentId: s.departmentId });
          }
        } else if (field === 'options') {
          for (const o of items) {
            await drizzleDb.insert(schema.answerOptions).values({ questionId: insertedId, ...o });
          }
        } else if (field === 'competencies') {
          for (const c of items) {
            await drizzleDb.insert(schema.questionCompetencies).values({ questionId: insertedId, ...c });
          }
        }
      }
    }
  }

  function cleanData(data) {
    const clean = {};
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === 'object' && ('create' in v || 'deleteMany' in v || 'connect' in v)) {
        continue;
      }
      clean[k] = v;
    }
    if (queryKey === 'notificationTemplates' && !clean.channels) {
      clean.channels = ['in_app'];
    }
    return clean;
  }

  return {
    async findFirst({ where, include, select, orderBy } = {}) {
      const withRelations = transformInclude(include, queryKey, drizzleDb);
      const conds = buildWhereConditions(table, where);
      const order = buildOrderBy(table, orderBy);

      if (withRelations && drizzleDb.query && drizzleDb.query[queryKey]) {
        const row = await drizzleDb.query[queryKey].findFirst({
          where: conds.length > 1 ? and(...conds) : conds[0],
          with: withRelations,
          orderBy: order.length ? order : undefined,
        });
        return attachCountProxy(row, include);
      }

      let q = drizzleDb.select().from(table);
      if (conds.length) q = q.where(conds.length > 1 ? and(...conds) : conds[0]);
      if (order.length) q = q.orderBy(...order);
      const rows = await q.limit(1);
      return attachCountProxy(rows[0] || null, include);
    },

    async findUnique({ where, include, select } = {}) {
      return this.findFirst({ where, include, select });
    },

    async findMany({ where, include, select, orderBy, skip, take } = {}) {
      const withRelations = transformInclude(include, queryKey, drizzleDb);
      const conds = buildWhereConditions(table, where);
      const order = buildOrderBy(table, orderBy);

      if (withRelations && drizzleDb.query && drizzleDb.query[queryKey]) {
        const rows = await drizzleDb.query[queryKey].findMany({
          where: conds.length > 1 ? and(...conds) : conds[0],
          with: withRelations,
          orderBy: order.length ? order : undefined,
          limit: take,
          offset: skip,
        });
        return attachCountProxy(rows, include);
      }

      let q = drizzleDb.select().from(table);
      if (conds.length) q = q.where(conds.length > 1 ? and(...conds) : conds[0]);
      if (order.length) q = q.orderBy(...order);
      if (take != null) q = q.limit(take);
      if (skip != null) q = q.offset(skip);

      const rows = await q;
      return attachCountProxy(rows, include);
    },

    async groupBy({ by = [], where, _count, _min, _max, _sum, _avg, orderBy, take, skip } = {}) {
      const byColumns = Array.isArray(by) ? by : [by];
      const selectObj = {};
      const groupByCols = [];

      for (const colName of byColumns) {
        const col = table[colName];
        if (col) {
          selectObj[colName] = col;
          groupByCols.push(col);
        }
      }

      if (_count) {
        selectObj['_count_all'] = count();
      }

      let q = drizzleDb.select(selectObj).from(table);
      const conds = buildWhereConditions(table, where);
      if (conds.length) {
        q = q.where(conds.length > 1 ? and(...conds) : conds[0]);
      }

      if (groupByCols.length) {
        q = q.groupBy(...groupByCols);
      }

      const order = buildOrderBy(table, orderBy);
      if (order.length) {
        q = q.orderBy(...order);
      }
      if (take != null) q = q.limit(take);
      if (skip != null) q = q.offset(skip);

      const rows = await q;
      return rows.map(r => {
        const res = { ...r };
        if (_count) {
          const countVal = Number(r._count_all ?? 0);
          delete res._count_all;
          res._count = { _all: countVal };
          for (const colName of byColumns) {
            res._count[colName] = countVal;
          }
        }
        return res;
      });
    },

    async aggregate({ where, _max, _min, _sum, _avg, _count } = {}) {
      const selectObj = {};
      if (_count) selectObj['_count_all'] = count();
      if (_max) {
        for (const [colName, v] of Object.entries(_max)) {
          if (v && table[colName]) selectObj[`_max_${colName}`] = sql`MAX(${table[colName]})`;
        }
      }
      if (_min) {
        for (const [colName, v] of Object.entries(_min)) {
          if (v && table[colName]) selectObj[`_min_${colName}`] = sql`MIN(${table[colName]})`;
        }
      }
      if (_sum) {
        for (const [colName, v] of Object.entries(_sum)) {
          if (v && table[colName]) selectObj[`_sum_${colName}`] = sql`SUM(${table[colName]})`;
        }
      }
      if (_avg) {
        for (const [colName, v] of Object.entries(_avg)) {
          if (v && table[colName]) selectObj[`_avg_${colName}`] = sql`AVG(${table[colName]})`;
        }
      }

      let q = drizzleDb.select(selectObj).from(table);
      const conds = buildWhereConditions(table, where);
      if (conds.length) {
        q = q.where(conds.length > 1 ? and(...conds) : conds[0]);
      }

      const [row] = await q;
      const result = {};
      if (_count) result._count = { _all: Number(row?._count_all ?? 0) };
      if (_max) {
        result._max = {};
        for (const colName of Object.keys(_max)) {
          result._max[colName] = row?.[`_max_${colName}`] != null ? Number(row[`_max_${colName}`]) : null;
        }
      }
      if (_min) {
        result._min = {};
        for (const colName of Object.keys(_min)) {
          result._min[colName] = row?.[`_min_${colName}`] != null ? Number(row[`_min_${colName}`]) : null;
        }
      }
      if (_sum) {
        result._sum = {};
        for (const colName of Object.keys(_sum)) {
          result._sum[colName] = row?.[`_sum_${colName}`] != null ? Number(row[`_sum_${colName}`]) : null;
        }
      }
      if (_avg) {
        result._avg = {};
        for (const colName of Object.keys(_avg)) {
          result._avg[colName] = row?.[`_avg_${colName}`] != null ? Number(row[`_avg_${colName}`]) : null;
        }
      }
      return result;
    },

    async create({ data, include, select }) {
      const row = cleanData(data);
      if (pk === 'id' && !row.id && table.id && table.id.dataType === 'string') {
        row.id = randomUUID();
      }
      const [res] = await drizzleDb.insert(table).values(row);
      const insertedId = res?.insertId || row.id || row[pk];

      await handleNestedRelations(insertedId, data);

      if (include || select) {
        return this.findFirst({ where: { [Array.isArray(pk) ? pk[0] : pk]: insertedId }, include, select });
      }
      return { id: insertedId, ...row };
    },

    async createMany({ data, skipDuplicates } = {}) {
      const list = Array.isArray(data) ? data : [data];
      if (!list.length) return { count: 0 };
      const rows = list.map(d => {
        const row = cleanData(d);
        if (pk === 'id' && !row.id && table.id && table.id.dataType === 'string') {
          row.id = randomUUID();
        }
        return row;
      });
      let q = drizzleDb.insert(table);
      if (skipDuplicates) {
        q = q.ignore();
      }
      const [res] = await q.values(rows);
      return { count: res?.affectedRows || rows.length };
    },

    async update({ where, data, include, select }) {
      const conds = buildWhereConditions(table, where);
      const row = cleanData(data);

      if (Object.keys(row).length > 0) {
        let q = drizzleDb.update(table).set(row);
        if (conds.length) q = q.where(conds.length > 1 ? and(...conds) : conds[0]);
        await q;
      }

      // Handle relation updates (e.g. roles: { deleteMany: {}, create: [...] })
      const existing = await this.findFirst({ where });
      if (existing) {
        for (const [field, val] of Object.entries(data)) {
          if (!val || typeof val !== 'object') continue;
          if (val.deleteMany) {
            if (field === 'roles') await drizzleDb.delete(schema.accountRoles).where(eq(schema.accountRoles.accountId, existing.id));
            if (field === 'permissions') await drizzleDb.delete(schema.accountPermissions).where(eq(schema.accountPermissions.accountId, existing.id));
            if (field === 'scopeDepartments') await drizzleDb.delete(schema.accountScopeDepartments).where(eq(schema.accountScopeDepartments.accountId, existing.id));
          }
          if (val.create) {
            await handleNestedRelations(existing.id, { [field]: val });
          }
        }
      }

      return this.findFirst({ where, include, select });
    },

    async updateMany({ where, data }) {
      const conds = buildWhereConditions(table, where);
      const row = cleanData(data);
      let q = drizzleDb.update(table).set(row);
      if (conds.length) q = q.where(conds.length > 1 ? and(...conds) : conds[0]);
      const [res] = await q;
      return { count: res?.affectedRows || 0 };
    },

    async delete({ where }) {
      const existing = await this.findFirst({ where });
      const conds = buildWhereConditions(table, where);
      let q = drizzleDb.delete(table);
      if (conds.length) q = q.where(conds.length > 1 ? and(...conds) : conds[0]);
      await q;
      return existing;
    },

    async deleteMany({ where } = {}) {
      const conds = buildWhereConditions(table, where);
      let q = drizzleDb.delete(table);
      if (conds.length) q = q.where(conds.length > 1 ? and(...conds) : conds[0]);
      const [res] = await q;
      return { count: res?.affectedRows || 0 };
    },

    async upsert({ where, update, create, include }) {
      const found = await this.findFirst({ where });
      if (found) {
        return this.update({ where, data: update, include });
      }
      return this.create({ data: create, include });
    },

    async count({ where } = {}) {
      const conds = buildWhereConditions(table, where);
      let q = drizzleDb.select({ val: count() }).from(table);
      if (conds.length) q = q.where(conds.length > 1 ? and(...conds) : conds[0]);
      const res = await q;
      return Number(res[0]?.val || 0);
    },
  };
}
