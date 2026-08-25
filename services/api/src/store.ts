import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { cloneFixtureCases, type CaseActionEvent, type ReturnIntegrityCase } from "@return-integrity/domain";

export interface DemoSession {
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  evaluationCount: number;
}

export interface WaitlistLead {
  email: string;
  emailHash: string;
  role: string;
  companyUrl?: string;
  consent: true;
  noticeVersion: string;
  submittedAt: string;
  expiresAt: string;
}

export interface DataStore {
  createSession(now?: Date): Promise<DemoSession>;
  getSession(sessionId: string): Promise<DemoSession | undefined>;
  resetSession(sessionId: string, now?: Date): Promise<DemoSession>;
  listCases(sessionId: string): Promise<ReturnIntegrityCase[]>;
  getCase(sessionId: string, caseId: string): Promise<ReturnIntegrityCase | undefined>;
  putCase(sessionId: string, caseData: ReturnIntegrityCase): Promise<void>;
  appendEvent(sessionId: string, caseId: string, event: CaseActionEvent, caseData: ReturnIntegrityCase): Promise<void>;
  acquireEvaluationSlot(sessionId: string, now?: Date): Promise<{ sessionCount: number; dayCount: number }>;
  saveWaitlistLead(lead: WaitlistLead): Promise<"CREATED" | "EXISTING">;
}

const expiryDate = (now: Date, days: number): string => new Date(now.getTime() + days * 24 * 60 * 60 * 1_000).toISOString();

export class MemoryStore implements DataStore {
  private readonly sessions = new Map<string, DemoSession>();
  private readonly cases = new Map<string, Map<string, ReturnIntegrityCase>>();
  private readonly dayCounts = new Map<string, number>();
  private readonly leads = new Map<string, WaitlistLead>();

  async createSession(now = new Date()): Promise<DemoSession> {
    const session: DemoSession = {
      sessionId: randomUUID(),
      createdAt: now.toISOString(),
      expiresAt: expiryDate(now, 1),
      evaluationCount: 0,
    };
    this.sessions.set(session.sessionId, session);
    this.cases.set(session.sessionId, new Map(cloneFixtureCases().map((caseData) => [caseData.caseId, caseData])));
    return structuredClone(session);
  }

  async getSession(sessionId: string): Promise<DemoSession | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return undefined;
    return structuredClone(session);
  }

  async resetSession(sessionId: string, now = new Date()): Promise<DemoSession> {
    const current = await this.getSession(sessionId);
    if (!current) throw new Error("SESSION_NOT_FOUND");
    const session: DemoSession = { ...current, evaluationCount: 0, expiresAt: expiryDate(now, 1) };
    this.sessions.set(sessionId, session);
    this.cases.set(sessionId, new Map(cloneFixtureCases().map((caseData) => [caseData.caseId, caseData])));
    return structuredClone(session);
  }

  async listCases(sessionId: string): Promise<ReturnIntegrityCase[]> {
    if (!await this.getSession(sessionId)) throw new Error("SESSION_NOT_FOUND");
    return [...(this.cases.get(sessionId)?.values() ?? [])].map((caseData) => structuredClone(caseData));
  }

  async getCase(sessionId: string, caseId: string): Promise<ReturnIntegrityCase | undefined> {
    if (!await this.getSession(sessionId)) throw new Error("SESSION_NOT_FOUND");
    const caseData = this.cases.get(sessionId)?.get(caseId);
    return caseData ? structuredClone(caseData) : undefined;
  }

  async putCase(sessionId: string, caseData: ReturnIntegrityCase): Promise<void> {
    if (!await this.getSession(sessionId)) throw new Error("SESSION_NOT_FOUND");
    this.cases.get(sessionId)?.set(caseData.caseId, structuredClone(caseData));
  }

  async appendEvent(sessionId: string, _caseId: string, _event: CaseActionEvent, caseData: ReturnIntegrityCase): Promise<void> {
    await this.putCase(sessionId, caseData);
  }

  async acquireEvaluationSlot(sessionId: string, now = new Date()): Promise<{ sessionCount: number; dayCount: number }> {
    const session = this.sessions.get(sessionId);
    if (!session || new Date(session.expiresAt).getTime() <= now.getTime()) throw new Error("SESSION_NOT_FOUND");
    const dateKey = now.toISOString().slice(0, 10);
    const dayCount = this.dayCounts.get(dateKey) ?? 0;
    if (session.evaluationCount >= 30) throw new Error("SESSION_EVALUATION_LIMIT");
    if (dayCount >= 250) throw new Error("DAILY_EVALUATION_LIMIT");
    session.evaluationCount += 1;
    this.dayCounts.set(dateKey, dayCount + 1);
    return { sessionCount: session.evaluationCount, dayCount: dayCount + 1 };
  }

  async saveWaitlistLead(lead: WaitlistLead): Promise<"CREATED" | "EXISTING"> {
    if (this.leads.has(lead.emailHash)) return "EXISTING";
    this.leads.set(lead.emailHash, structuredClone(lead));
    return "CREATED";
  }
}

interface DynamoStoreOptions {
  caseTableName: string;
  waitlistTableName?: string;
  client?: DynamoDBDocumentClient;
}

export class DynamoStore implements DataStore {
  private readonly tableName: string;
  private readonly waitlistTableName: string;
  private readonly dedicatedWaitlistTable: boolean;
  private readonly client: DynamoDBDocumentClient;

  constructor(options: DynamoStoreOptions) {
    this.tableName = options.caseTableName;
    this.waitlistTableName = options.waitlistTableName ?? options.caseTableName;
    this.dedicatedWaitlistTable = options.waitlistTableName !== undefined;
    this.client = options.client ?? DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  private sessionKey(sessionId: string): { PK: string; SK: string } {
    return { PK: `SESSION#${sessionId}`, SK: "META" };
  }

  private caseKey(sessionId: string, caseId: string): { PK: string; SK: string } {
    return { PK: `SESSION#${sessionId}`, SK: `CASE#${caseId}` };
  }

  async createSession(now = new Date()): Promise<DemoSession> {
    const session: DemoSession = {
      sessionId: randomUUID(),
      createdAt: now.toISOString(),
      expiresAt: expiryDate(now, 1),
      evaluationCount: 0,
    };
    const ttl = Math.floor(new Date(session.expiresAt).getTime() / 1_000);
    await this.client.send(new TransactWriteCommand({ TransactItems: [
      { Put: { TableName: this.tableName, Item: { ...this.sessionKey(session.sessionId), entity: "Session", ...session, ttl } } },
      ...cloneFixtureCases().map((caseData) => ({ Put: { TableName: this.tableName, Item: { ...this.caseKey(session.sessionId, caseData.caseId), entity: "Case", caseData, ttl } } })),
    ] }));
    return session;
  }

  async getSession(sessionId: string): Promise<DemoSession | undefined> {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: this.sessionKey(sessionId) }));
    if (!result.Item) return undefined;
    const session: DemoSession = {
      sessionId: String(result.Item.sessionId),
      createdAt: String(result.Item.createdAt),
      expiresAt: String(result.Item.expiresAt),
      evaluationCount: Number(result.Item.evaluationCount ?? 0),
    };
    if (new Date(session.expiresAt).getTime() <= Date.now()) return undefined;
    return session;
  }

  async resetSession(sessionId: string, now = new Date()): Promise<DemoSession> {
    const existing = await this.getSession(sessionId);
    if (!existing) throw new Error("SESSION_NOT_FOUND");
    const existingCases = await this.listCases(sessionId);
    for (const caseData of existingCases) {
      await this.client.send(new DeleteCommand({ TableName: this.tableName, Key: this.caseKey(sessionId, caseData.caseId) }));
    }
    const session: DemoSession = { ...existing, evaluationCount: 0, expiresAt: expiryDate(now, 1) };
    const ttl = Math.floor(new Date(session.expiresAt).getTime() / 1_000);
    await this.client.send(new TransactWriteCommand({ TransactItems: [
      { Put: { TableName: this.tableName, Item: { ...this.sessionKey(sessionId), entity: "Session", ...session, ttl } } },
      ...cloneFixtureCases().map((caseData) => ({ Put: { TableName: this.tableName, Item: { ...this.caseKey(sessionId, caseData.caseId), entity: "Case", caseData, ttl } } })),
    ] }));
    return session;
  }

  async listCases(sessionId: string): Promise<ReturnIntegrityCase[]> {
    if (!await this.getSession(sessionId)) throw new Error("SESSION_NOT_FOUND");
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :case)",
      ExpressionAttributeValues: { ":pk": `SESSION#${sessionId}`, ":case": "CASE#" },
    }));
    return (result.Items ?? []).map((item) => item.caseData as ReturnIntegrityCase);
  }

  async getCase(sessionId: string, caseId: string): Promise<ReturnIntegrityCase | undefined> {
    if (!await this.getSession(sessionId)) throw new Error("SESSION_NOT_FOUND");
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: this.caseKey(sessionId, caseId) }));
    return result.Item?.caseData as ReturnIntegrityCase | undefined;
  }

  async putCase(sessionId: string, caseData: ReturnIntegrityCase): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error("SESSION_NOT_FOUND");
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        ...this.caseKey(sessionId, caseData.caseId),
        entity: "Case",
        caseData,
        ttl: Math.floor(new Date(session.expiresAt).getTime() / 1_000),
      },
    }));
  }

  async appendEvent(sessionId: string, caseId: string, event: CaseActionEvent, caseData: ReturnIntegrityCase): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error("SESSION_NOT_FOUND");
    const ttl = Math.floor(new Date(session.expiresAt).getTime() / 1_000);
    await this.client.send(new TransactWriteCommand({ TransactItems: [
      { Put: { TableName: this.tableName, Item: { ...this.caseKey(sessionId, caseId), entity: "Case", caseData, ttl } } },
      { Put: { TableName: this.tableName, Item: { PK: `SESSION#${sessionId}`, SK: `EVENT#${event.occurredAt}#${event.eventId}`, entity: "CaseEvent", event, ttl } } },
    ] }));
  }

  async acquireEvaluationSlot(sessionId: string, now = new Date()): Promise<{ sessionCount: number; dayCount: number }> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error("SESSION_NOT_FOUND");
    const dateKey = now.toISOString().slice(0, 10);
    const dayTtl = Math.floor(new Date(`${dateKey}T00:00:00.000Z`).getTime() / 1_000) + 2 * 24 * 60 * 60;
    try {
      await this.client.send(new TransactWriteCommand({ TransactItems: [
        { Update: {
          TableName: this.tableName,
          Key: this.sessionKey(sessionId),
          UpdateExpression: "SET evaluationCount = if_not_exists(evaluationCount, :zero) + :one",
          ConditionExpression: "attribute_exists(PK) AND (attribute_not_exists(evaluationCount) OR evaluationCount < :sessionLimit)",
          ExpressionAttributeValues: { ":zero": 0, ":one": 1, ":sessionLimit": 30 },
        } },
        { Update: {
          TableName: this.tableName,
          Key: { PK: `RATE#${dateKey}`, SK: "MODEL_EVALUATIONS" },
          UpdateExpression: "SET evaluationCount = if_not_exists(evaluationCount, :zero) + :one, #ttl = :ttl",
          ConditionExpression: "attribute_not_exists(evaluationCount) OR evaluationCount < :dailyLimit",
          ExpressionAttributeNames: { "#ttl": "ttl" },
          ExpressionAttributeValues: { ":zero": 0, ":one": 1, ":dailyLimit": 250, ":ttl": dayTtl },
        } },
      ] }));
    } catch {
      const refreshed = await this.getSession(sessionId);
      if ((refreshed?.evaluationCount ?? 30) >= 30) throw new Error("SESSION_EVALUATION_LIMIT");
      throw new Error("DAILY_EVALUATION_LIMIT");
    }
    const countResult = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { PK: `RATE#${dateKey}`, SK: "MODEL_EVALUATIONS" } }));
    return { sessionCount: session.evaluationCount + 1, dayCount: Number(countResult.Item?.evaluationCount ?? 1) };
  }

  async saveWaitlistLead(lead: WaitlistLead): Promise<"CREATED" | "EXISTING"> {
    try {
      await this.client.send(new PutCommand({
        TableName: this.waitlistTableName,
        Item: {
          ...(this.dedicatedWaitlistTable ? {} : { PK: `LEAD#${lead.emailHash}`, SK: "PROFILE" }),
          entity: "WaitlistLead",
          ...lead,
          ttl: Math.floor(new Date(lead.expiresAt).getTime() / 1_000),
        },
        ConditionExpression: this.dedicatedWaitlistTable ? "attribute_not_exists(emailHash)" : "attribute_not_exists(PK)",
      }));
      return "CREATED";
    } catch (error) {
      if (error instanceof Error && error.name === "ConditionalCheckFailedException") return "EXISTING";
      throw error;
    }
  }
}

let sharedStore: DataStore | undefined;

export const createStoreFromEnvironment = (): DataStore => {
  if (sharedStore) return sharedStore;
  const caseTableName = process.env.CASE_TABLE_NAME ?? process.env.CASES_TABLE_NAME ?? process.env.TABLE_NAME;
  sharedStore = caseTableName
    ? new DynamoStore({ caseTableName, waitlistTableName: process.env.WAITLIST_TABLE_NAME })
    : new MemoryStore();
  return sharedStore;
};

export const setStoreForTests = (store: DataStore | undefined): void => {
  sharedStore = store;
};
