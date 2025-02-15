import { GameState, Action } from "../../types";
import { MarketAnalyzer } from "./MarketAnalyzer";

interface TradeConfig {
  maxRiskPerTrade: number;
  minConfidence: number;
  maxPositionSize: number;
  stopLossPercent: number;
  takeProfitPercent: number;
}

interface Position {
  resourceType: string;
  amount: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  timestamp: number;
}

export class TradeExecutor {
  private positions: Map<string, Position> = new Map();
  private analyzer: MarketAnalyzer;
  private config: TradeConfig;

  constructor(
    analyzer: MarketAnalyzer,
    config: TradeConfig = {
      maxRiskPerTrade: 0.02,
      minConfidence: 0.7,
      maxPositionSize: 1000,
      stopLossPercent: 0.05,
      takeProfitPercent: 0.1
    }
  ) {
    this.analyzer = analyzer;
    this.config = config;
  }

  async executeTrades(gameState: GameState): Promise<Action[]> {
    const { opportunities } = this.analyzer.analyzeMarket(gameState);
    const actions: Action[] = [];

    // Manage existing positions
    this.positions.forEach((position, resourceType) => {
      const currentPrice = gameState.marketPrices?.get(resourceType);
      if (currentPrice) {
        const action = this.checkPosition(position, currentPrice);
        if (action) actions.push(action);
      }
    });

    // Execute new trades
    for (const opportunity of opportunities) {
      if (this.validateOpportunity(opportunity)) {
        const action = this.createTradeAction(opportunity);
        if (action) actions.push(action);
      }
    }

    return actions;
  }

  private checkPosition(position: Position, currentPrice: number): Action | null {
    if (currentPrice <= position.stopLoss) {
      return this.createExitAction(position, "STOP_LOSS");
    }

    if (currentPrice >= position.takeProfit) {
      return this.createExitAction(position, "TAKE_PROFIT");
    }

    return null;
  }

  private validateOpportunity(opportunity: any): boolean {
    if (opportunity.risk > this.config.maxRiskPerTrade) return false;
    if (opportunity.confidence < this.config.minConfidence) return false;
    if (this.positions.has(opportunity.resourceType)) return false;

    const totalRisk = this.calculateTotalRisk();
    if (totalRisk + opportunity.risk > this.config.maxRiskPerTrade * 3) {
      return false;
    }

    return true;
  }

  private createTradeAction(opportunity: any): Action {
    const amount = Math.min(
      opportunity.amount,
      this.config.maxPositionSize
    );

    const position: Position = {
      resourceType: opportunity.resourceType,
      amount,
      entryPrice: opportunity.price,
      stopLoss: this.calculateStopLoss(opportunity),
      takeProfit: this.calculateTakeProfit(opportunity),
      timestamp: Date.now()
    };

    this.positions.set(opportunity.resourceType, position);

    return {
      type: "TRADE",
      payload: {
        resourceType: opportunity.resourceType,
        action: opportunity.action,
        amount,
        price: opportunity.price
      }
    };
  }

  private createExitAction(position: Position, reason: string): Action {
    this.positions.delete(position.resourceType);

    return {
      type: "TRADE",
      payload: {
        resourceType: position.resourceType,
        action: "SELL",
        amount: position.amount,
        price: "MARKET",
        reason
      }
    };
  }

  private calculateStopLoss(opportunity: any): number {
    return opportunity.action === "BUY"
      ? opportunity.price * (1 - this.config.stopLossPercent)
      : opportunity.price * (1 + this.config.stopLossPercent);
  }

  private calculateTakeProfit(opportunity: any): number {
    return opportunity.action === "BUY"
      ? opportunity.price * (1 + this.config.takeProfitPercent)
      : opportunity.price * (1 - this.config.takeProfitPercent);
  }

  private calculateTotalRisk(): number {
    return Array.from(this.positions.values()).reduce(
      (total, position) => total + this.calculatePositionRisk(position),
      0
    );
  }

  private calculatePositionRisk(position: Position): number {
    const riskAmount = Math.abs(position.entryPrice - position.stopLoss);
    return (riskAmount * position.amount) / position.entryPrice;
  }

  getPositions(): Map<string, Position> {
    return new Map(this.positions);
  }

  updateConfig(newConfig: Partial<TradeConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
} 