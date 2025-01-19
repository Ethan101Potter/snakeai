import Web3 from "web3";
import { TransactionConfig } from "../types";

export class TransactionOptimizer {
  private readonly MAX_GAS_PRICE_INCREASE = 1.5;
  private readonly MIN_GAS_PRICE_INCREASE = 1.1;
  private readonly MAX_RETRIES = 3;
  private readonly PRIORITY_LEVELS = {
    HIGH: 2,
    MEDIUM: 1.5,
    LOW: 1.1,
  };

  constructor(private web3: Web3) {}

  async optimizeTransaction(
    baseConfig: TransactionConfig,
    priority: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM"
  ): Promise<TransactionConfig> {
    const gasPrice = await this.calculateOptimalGasPrice(priority);
    const gasLimit = await this.estimateGasLimit(baseConfig);

    return {
      ...baseConfig,
      gasPrice: gasPrice.toString(),
      gas: Math.ceil(gasLimit * 1.1), // Add 10% buffer
    };
  }

  private async calculateOptimalGasPrice(
    priority: "HIGH" | "MEDIUM" | "LOW"
  ): Promise<string> {
    const baseGasPrice = await this.web3.eth.getGasPrice();
    const multiplier = this.PRIORITY_LEVELS[priority];
    return (BigInt(baseGasPrice) * BigInt(Math.floor(multiplier * 100)) / BigInt(100)).toString();
  }

  private async estimateGasLimit(config: TransactionConfig): Promise<number> {
    try {
      const gasEstimate = await this.web3.eth.estimateGas({
        to: config.to,
        data: config.data,
        from: config.from,
        value: config.value,
      });
      return gasEstimate;
    } catch (error) {
      console.error("Gas estimation failed:", error);
      return 21000; // Default minimum gas limit
    }
  }

  async waitForTransaction(
    txHash: string,
    timeout: number = 60000
  ): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      try {
        const receipt = await this.web3.eth.getTransactionReceipt(txHash);
        if (receipt) {
          return receipt.status;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error("Error checking transaction:", error);
      }
    }
    throw new Error("Transaction confirmation timeout");
  }

  async getTransactionStatus(txHash: string): Promise<{
    confirmed: boolean;
    blockNumber?: number;
    gasUsed?: number;
  }> {
    try {
      const receipt = await this.web3.eth.getTransactionReceipt(txHash);
      if (!receipt) {
        return { confirmed: false };
      }
      return {
        confirmed: true,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
      };
    } catch (error) {
      console.error("Error getting transaction status:", error);
      return { confirmed: false };
    }
  }
} 