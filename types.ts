
export enum OrderStatus {
  COMPLETED = 'Completed',
  PAID = 'Paid',
  DELIVERED = 'Delivered',
  CANCELLED = 'Cancelled',
  FAILED = 'Failed',
  IN_PROGRESS = 'InProgress',
  UNKNOWN = 'Unknown'
}

export interface OrderRow {
  orderId: string;
  sku: string;
  productPrice: number; // IDR
  quantity: number;
  status: OrderStatus;
  shippingSubsidy: number; // IDR (Subsidi Pengiriman)
  logisticFee: number; // Shipping fee charged by logistic provider
  rawStatus: string;
  rawCommissionFee: number; // 从报表读取的佣金
  rawServiceFee: number; // 从报表读取的服务费
  estimatedIncome?: number; // 从报表读取的预计到手 (Total Penghasilan)
}

export interface CostRow {
  sku: string;
  unitCostRMB: number;
  shipMultiplier: number; // 乘数 (如买一送一设为 2)
  note?: string;
}

export interface CalculatedOrder extends OrderRow {
  costRMB: number;
  commissionFee: number;
  isCommissionActual: boolean;
  serviceFee: number;
  isServiceActual: boolean;
  processingFee: number;
  xtraFee: number;
  feesTotal: number;
  netIncomeIDR: number;
  isIncomeActual: boolean;
  netProfitRMB: number;
  isMatchedCost: boolean;
  commissionRateUsed: number;
  commissionSource: 'Order' | 'SKU Map' | 'Global Default';
}

export interface AppConfig {
  exchangeRate: number; // 1 RMB = ? IDR
  commissionRate: number; // 默认 0.095
  serviceRate: number; // 默认 0.045
  processingFeeFixed: number; // 默认 1250
  xtraEnabled: boolean;
  xtraRate: number; // 默认 0.05
  skuCommissionRateMap: Record<string, number>;
}
