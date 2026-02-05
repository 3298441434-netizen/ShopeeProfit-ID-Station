
import * as XLSX from 'xlsx';
import { OrderRow, OrderStatus, CostRow } from '../types';

/**
 * 鲁棒性解析货币字符串，处理印尼格式 "Rp 28.850" 或 "28,850"
 */
export const parseIDR = (val: any): number => {
  if (typeof val === 'number') return isFinite(val) ? val : 0;
  if (val === undefined || val === null || val === '') return 0;
  
  let s = String(val).trim();
  s = s.replace(/Rp/gi, '').replace(/\s+/g, '');
  
  // 印尼通常用 . 作为千分位，, 作为小数位
  // 这里统一移除所有点，并将逗号替换为点
  s = s.split('.').join('');
  s = s.replace(',', '.');
  
  const num = parseFloat(s);
  return isFinite(num) ? num : 0;
};

/**
 * 状态映射
 */
const mapStatus = (status: string): OrderStatus => {
  const s = status?.toLowerCase() || '';
  if (s.includes('selesai') || s.includes('completed')) return OrderStatus.COMPLETED;
  if (s.includes('dikirim') || s.includes('delivered') || s.includes('shipping')) return OrderStatus.DELIVERED;
  if (s.includes('paid') || s.includes('sudah bayar') || s.includes('bayar')) return OrderStatus.PAID;
  if (s.includes('batal') || s.includes('cancelled') || s.includes('dibatalkan')) return OrderStatus.CANCELLED;
  if (s.includes('gagal') || s.includes('failed')) return OrderStatus.FAILED;
  if (s.includes('perlu dikirim') || s.includes('to ship') || s.includes('processed')) return OrderStatus.IN_PROGRESS;
  return OrderStatus.UNKNOWN;
};

/**
 * 解析 Shopee 订单表
 */
export const parseOrders = async (file: File): Promise<OrderRow[]> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json: any[] = XLSX.utils.sheet_to_json(sheet);

  return json.map(row => {
    const orderId = row['No. Pesanan'] || row['Order ID'] || row['Order No.'] || '';
    const sku = row['Nomor Referensi SKU'] || row['SKU Reference No.'] || row['SKU Number'] || row['Parent SKU'] || row['Variation SKU'] || '';
    
    const price = parseIDR(row['Total Harga Produk'] || row['Merchandise Subtotal'] || row['Product Price'] || 0);
    const qty = parseInt(String(row['Jumlah'] || row['Quantity'] || 1)) || 1;
    const rawStatus = row['Status Pesanan'] || row['Order Status'] || '';
    const status = mapStatus(rawStatus);
    const subsidy = parseIDR(row['Subsidi Pengiriman dari Shopee'] || row['Shipping Fee Rebate from Shopee'] || 0);
    const logisticFee = parseIDR(row['Ongkos Kirim yang Dibayar oleh Pembeli'] || row['Shipping Fee Paid by Buyer'] || 0);
    
    const rawCommissionFee = Math.abs(parseIDR(row['Biaya Komisi'] || row['Commission Fee'] || 0));
    const rawServiceFee = Math.abs(parseIDR(row['Biaya Layanan'] || row['Service Fee'] || 0));
    
    // 提取预计到手收入
    const estimatedIncome = parseIDR(
      row['Total Penghasilan'] || 
      row['Estimated Order Income'] || 
      row['Estimated Income'] || 
      row['Penghasilan Pesanan'] || 
      0
    );

    return {
      orderId,
      sku: String(sku).trim(),
      productPrice: price,
      quantity: qty,
      status,
      shippingSubsidy: subsidy,
      logisticFee,
      rawStatus,
      rawCommissionFee,
      rawServiceFee,
      estimatedIncome
    };
  }).filter(o => o.orderId);
};

export const parseAds = async (file: File): Promise<number> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  let totalSpend = 0;
  let headerIndex = -1;
  let spendColIndex = -1;

  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i];
    if (!row) continue;
    spendColIndex = row.findIndex(cell => {
      const c = String(cell).toLowerCase();
      return c === 'expense' || c === 'spend' || c === 'cost' || c.includes('total spend') || c.includes('ad spend') || c.includes('biaya');
    });
    if (spendColIndex !== -1) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex !== -1 && spendColIndex !== -1) {
    for (let i = headerIndex + 1; i < rows.length; i++) {
      const val = parseIDR(rows[i][spendColIndex]);
      totalSpend += val;
    }
  }

  return totalSpend;
};

export const parseCosts = async (file: File): Promise<CostRow[]> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  let headerRowIndex = -1;
  let skuCol = -1;
  let costCol = -1;
  let multCol = -1;

  const skuPatterns = ['sku', 'item code', 'nomor referensi', '商品代码'];
  const costPatterns = ['cost', '成本', 'price', 'rmb', 'rnb'];
  const multPatterns = ['unit', 'multiplier', '倍数', '数量', 'jumlah'];

  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;

    const findCol = (patterns: string[]) => row.findIndex(cell => {
      const c = String(cell || '').toLowerCase().replace(/[\s_-]/g, '');
      return patterns.some(p => c.includes(p.toLowerCase().replace(/[\s_-]/g, '')));
    });

    const tempSku = findCol(skuPatterns);
    const tempCost = findCol(costPatterns);

    if (tempSku !== -1 && tempCost !== -1) {
      headerRowIndex = i;
      skuCol = tempSku;
      costCol = tempCost;
      multCol = findCol(multPatterns);
      break;
    }
  }

  if (headerRowIndex === -1) {
    const sampleHeaders = rows.slice(0, 5).map(r => r.join(', ')).filter(s => s).join(' | ');
    throw new Error(`无法识别成本库表头！\n前几行检测到的内容: [${sampleHeaders}]\n\n请确保表格包含 "SKU" 和 "COST_RMB" (或 "成本") 列。`);
  }

  const result: CostRow[] = [];
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[skuCol]) continue;

    let sku = String(row[skuCol]).trim();
    sku = sku.replace(/^sku:/i, '').trim();

    const cost = parseFloat(String(row[costCol]).replace(/[^0-9.]/g, '')) || 0;
    const mult = multCol !== -1 ? (parseFloat(String(row[multCol]).replace(/[^0-9.]/g, '')) || 1) : 1;

    if (sku) {
      result.push({
        sku,
        unitCostRMB: cost,
        shipMultiplier: mult
      });
    }
  }

  return result;
};
