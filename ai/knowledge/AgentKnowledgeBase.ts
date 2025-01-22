import { Vector2D } from "../../types/common";
import { GameState, AgentType } from "../../types";

export interface ResourceInfo {
  location: Vector2D;
  type: string;
  amount: number;
  lastUpdate: number;
}

export interface ThreatInfo {
  id: string;
  position: Vector2D;
  threat_level: number;
  last_seen: number;
}

export interface MarketInfo {
  resourceType: string;
  price: number;
  volume: number;
  trend: "up" | "down" | "stable";
  lastUpdate: number;
}

export class AgentKnowledgeBase {
  private resources: Map<string, ResourceInfo> = new Map();
  private threats: Map<string, ThreatInfo> = new Map();
  private market: Map<string, MarketInfo> = new Map();
  private territory: Set<string> = new Set();
  
  private readonly KNOWLEDGE_EXPIRY = 60000; // 1 minute
  
  constructor(private agentType: AgentType) {}

  updateResource(resourceId: string, info: Partial<ResourceInfo>): void {
    const existing = this.resources.get(resourceId) || {
      location: { x: 0, y: 0 },
      type: "",
      amount: 0,
      lastUpdate: 0
    };
    
    this.resources.set(resourceId, {
      ...existing,
      ...info,
      lastUpdate: Date.now()
    });
  }

  updateThreat(threatId: string, info: Partial<ThreatInfo>): void {
    const existing = this.threats.get(threatId) || {
      id: threatId,
      position: { x: 0, y: 0 },
      threat_level: 0,
      last_seen: 0
    };
    
    this.threats.set(threatId, {
      ...existing,
      ...info,
      last_seen: Date.now()
    });
  }

  updateMarket(resourceType: string, info: Partial<MarketInfo>): void {
    const existing = this.market.get(resourceType) || {
      resourceType,
      price: 0,
      volume: 0,
      trend: "stable",
      lastUpdate: 0
    };
    
    this.market.set(resourceType, {
      ...existing,
      ...info,
      lastUpdate: Date.now()
    });
  }

  getKnownResources(maxAge?: number): ResourceInfo[] {
    const now = Date.now();
    return Array.from(this.resources.values())
      .filter(info => !maxAge || now - info.lastUpdate < maxAge);
  }

  getActiveThreats(): ThreatInfo[] {
    const now = Date.now();
    return Array.from(this.threats.values())
      .filter(threat => now - threat.last_seen < this.KNOWLEDGE_EXPIRY)
      .sort((a, b) => b.threat_level - a.threat_level);
  }

  getMarketOpportunities(): MarketInfo[] {
    const now = Date.now();
    return Array.from(this.market.values())
      .filter(info => now - info.lastUpdate < this.KNOWLEDGE_EXPIRY)
      .sort((a, b) => {
        if (a.trend === "up" && b.trend !== "up") return -1;
        if (a.trend !== "up" && b.trend === "up") return 1;
        return b.price - a.price;
      });
  }

  cleanup(): void {
    const now = Date.now();
    
    // Clean up expired knowledge
    for (const [id, info] of this.resources) {
      if (now - info.lastUpdate > this.KNOWLEDGE_EXPIRY) {
        this.resources.delete(id);
      }
    }
    
    for (const [id, threat] of this.threats) {
      if (now - threat.last_seen > this.KNOWLEDGE_EXPIRY) {
        this.threats.delete(id);
      }
    }
    
    for (const [type, info] of this.market) {
      if (now - info.lastUpdate > this.KNOWLEDGE_EXPIRY) {
        this.market.delete(type);
      }
    }
  }
} 