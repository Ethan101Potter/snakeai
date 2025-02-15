import { GameState } from "../../types";

interface MarketTrend {
  resourceType: string;
  currentPrice: number;
  priceChange: number;
  volume: number;
  trend: "UP" | "DOWN" | "STABLE";
  confidence: number;
}

interface TradeOpportunity {
  resourceType: string;
  action: "BUY" | "SELL";
  price: number;
  amount: number;
  expectedProfit: number;
  risk: number;
}

export class MarketAnalyzer {
  private priceHistory: Map<string, number[]> = new Map();
  private volumeHistory: Map<string, number[]> = new Map();
  private readonly HISTORY_LENGTH = 100;
  private readonly TREND_THRESHOLD = 0.05;

  analyzeMarket(gameState: GameState): {
    trends: MarketTrend[];
    opportunities: TradeOpportunity[];
  } {
    this.updateHistory(gameState);
    const trends = this.analyzeTrends();
    const opportunities = this.findOpportunities(trends);

    return {
      trends,
      opportunities: this.filterOpportunities(opportunities)
    };
  }

  private updateHistory(gameState: GameState): void {
    gameState.marketPrices?.forEach((price, resourceType) => {
      let prices = this.priceHistory.get(resourceType) || [];
      prices.push(price);
      if (prices.length > this.HISTORY_LENGTH) {
        prices = prices.slice(-this.HISTORY_LENGTH);
      }
      this.priceHistory.set(resourceType, prices);
    });

    gameState.tradingVolume?.forEach((volume, resourceType) => {
      let volumes = this.volumeHistory.get(resourceType) || [];
      volumes.push(volume);
      if (volumes.length > this.HISTORY_LENGTH) {
        volumes = volumes.slice(-this.HISTORY_LENGTH);
      }
      this.volumeHistory.set(resourceType, volumes);
    });
  }

  private analyzeTrends(): MarketTrend[] {
    const trends: MarketTrend[] = [];

    this.priceHistory.forEach((prices, resourceType) => {
      if (prices.length < 2) return;

      const currentPrice = prices[prices.length - 1];
      const previousPrice = prices[prices.length - 2];
      const priceChange = (currentPrice - previousPrice) / previousPrice;

      const volumes = this.volumeHistory.get(resourceType) || [];
      const currentVolume = volumes[volumes.length - 1] || 0;

      const trend = this.calculateTrend(prices);
      const confidence = this.calculateConfidence(prices, volumes);

      trends.push({
        resourceType,
        currentPrice,
        priceChange,
        volume: currentVolume,
        trend,
        confidence
      });
    });

    return trends;
  }

  private calculateTrend(prices: number[]): "UP" | "DOWN" | "STABLE" {
    if (prices.length < 10) return "STABLE";

    const recentPrices = prices.slice(-10);
    const avgChange = this.calculateAverageChange(recentPrices);

    if (avgChange > this.TREND_THRESHOLD) return "UP";
    if (avgChange < -this.TREND_THRESHOLD) return "DOWN";
    return "STABLE";
  }

  private calculateConfidence(prices: number[], volumes: number[]): number {
    const priceVolatility = this.calculateVolatility(prices);
    const volumeStrength = this.calculateVolumeStrength(volumes);
    const trendConsistency = this.calculateTrendConsistency(prices);

    return (1 - priceVolatility) * 0.4 + 
           volumeStrength * 0.3 + 
           trendConsistency * 0.3;
  }

  private findOpportunities(trends: MarketTrend[]): TradeOpportunity[] {
    return trends
      .filter(trend => trend.confidence > 0.6)
      .map(trend => {
        const action = trend.trend === "UP" ? "BUY" : "SELL";
        const risk = 1 - trend.confidence;
        const expectedProfit = this.calculateExpectedProfit(trend);

        return {
          resourceType: trend.resourceType,
          action,
          price: trend.currentPrice,
          amount: this.calculateOptimalAmount(trend),
          expectedProfit,
          risk
        };
      });
  }

  private filterOpportunities(opportunities: TradeOpportunity[]): TradeOpportunity[] {
    return opportunities
      .filter(opp => opp.expectedProfit > opp.risk * 100)
      .sort((a, b) => b.expectedProfit / b.risk - a.expectedProfit / a.risk);
  }

  // Helper methods
  private calculateAverageChange(prices: number[]): number {
    let totalChange = 0;
    for (let i = 1; i < prices.length; i++) {
      totalChange += (prices[i] - prices[i - 1]) / prices[i - 1];
    }
    return totalChange / (prices.length - 1);
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 1;
    
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(Math.abs((prices[i] - prices[i - 1]) / prices[i - 1]));
    }

    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
    return Math.min(1, avgChange * 10);
  }

  private calculateVolumeStrength(volumes: number[]): number {
    if (volumes.length < 2) return 0;

    const recentVolume = volumes[volumes.length - 1];
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;

    return Math.min(1, recentVolume / avgVolume);
  }

  private calculateTrendConsistency(prices: number[]): number {
    if (prices.length < 10) return 0;

    let consistentMoves = 0;
    const trend = this.calculateTrend(prices);
    
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if ((trend === "UP" && change > 0) || (trend === "DOWN" && change < 0)) {
        consistentMoves++;
      }
    }

    return consistentMoves / (prices.length - 1);
  }

  private calculateExpectedProfit(trend: MarketTrend): number {
    const volatility = this.calculateVolatility(
      this.priceHistory.get(trend.resourceType) || []
    );
    const priceImpact = Math.abs(trend.priceChange) * (1 - volatility);
    return trend.currentPrice * priceImpact * trend.confidence;
  }

  private calculateOptimalAmount(trend: MarketTrend): number {
    const baseAmount = 100;
    const volumeMultiplier = Math.min(1, trend.volume / 1000);
    const confidenceMultiplier = trend.confidence;
    
    return Math.floor(baseAmount * volumeMultiplier * confidenceMultiplier);
  }
} 