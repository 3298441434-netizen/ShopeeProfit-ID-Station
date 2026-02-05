
import React, { useState, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Upload, 
  Settings, 
  Table as TableIcon, 
  TrendingUp, 
  CheckCircle2,
  Clock,
  XCircle,
  FileSpreadsheet,
  Megaphone,
  Database,
  Coins,
  PackageSearch,
  AlertTriangle,
  Wallet,
  Calculator,
  Percent,
  Zap,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { OrderRow, CostRow, AppConfig, CalculatedOrder, OrderStatus } from './types';
import { parseOrders, parseAds, parseCosts, parseIDR } from './utils/excelParser';

const App: React.FC = () => {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [totalAdsSpend, setTotalAdsSpend] = useState<number>(0);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState<AppConfig>({
    exchangeRate: 2425, // 1 RMB = 2425 IDR
    commissionRate: 0.095,
    serviceRate: 0.045,
    processingFeeFixed: 1250,
    xtraEnabled: false,
    xtraRate: 0.05,
    skuCommissionRateMap: {}
  });

  const toggleExpand = (orderId: string, sku: string) => {
    const key = `${orderId}-${sku}`;
    const next = new Set(expandedOrders);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedOrders(next);
  };

  const learnCommissionRates = () => {
    const newSkuMap = { ...config.skuCommissionRateMap };
    let learnedCount = 0;
    orders.forEach(o => {
      if (o.sku && o.rawCommissionFee > 0 && o.productPrice > 0) {
        const calculatedRate = o.rawCommissionFee / o.productPrice;
        let snappedRate = calculatedRate;
        if (Math.abs(calculatedRate - 0.095) < 0.005) snappedRate = 0.095;
        else if (Math.abs(calculatedRate - 0.0825) < 0.005) snappedRate = 0.0825;
        if (newSkuMap[o.sku] !== snappedRate) {
          newSkuMap[o.sku] = snappedRate;
          learnedCount++;
        }
      }
    });
    if (learnedCount > 0) {
      setConfig({ ...config, skuCommissionRateMap: newSkuMap });
      alert(`成功识别并更新了 ${learnedCount} 个 SKU 的佣金率配置。`);
    } else {
      alert('未在当前订单中发现可用于学习的佣金费率信息。');
    }
  };

  const handleOrderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const data = await parseOrders(file);
        setOrders([...data]);
        setCosts([]);
        setTotalAdsSpend(0);
        setExpandedOrders(new Set());
      } catch (err) { alert('订单表导入失败，请检查格式'); }
    }
  };

  const handleAdsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const spend = await parseAds(file);
        setTotalAdsSpend(spend);
      } catch (err) { alert('广告表导入失败，请检查文件头位置'); }
    }
  };

  const handleCostUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const data = await parseCosts(file);
        setCosts(data);
      } catch (err) { alert('成本库导入失败'); }
    }
  };

  const calculatedData = useMemo(() => {
    const costMap = new Map<string, CostRow>();
    costs.forEach(c => costMap.set(c.sku, c));

    return orders.map(order => {
      const costItem = costMap.get(order.sku);
      const isMatched = !!costItem;
      const unitCostRMB = costItem?.unitCostRMB || 0;
      const multiplier = costItem?.shipMultiplier || 1;
      const price = order.productPrice;

      const isCancelled = order.status === OrderStatus.CANCELLED || order.status === OrderStatus.FAILED;

      // --- 佣金逻辑 ---
      let commissionFee = 0;
      let commRateUsed = 0;
      let commSource: 'Order' | 'SKU Map' | 'Global Default' = 'Global Default';
      let isCommissionActual = false;

      if (order.rawCommissionFee > 0) {
        commissionFee = order.rawCommissionFee;
        commRateUsed = commissionFee / price;
        commSource = 'Order';
        isCommissionActual = true;
      } else if (config.skuCommissionRateMap[order.sku]) {
        commRateUsed = config.skuCommissionRateMap[order.sku];
        commissionFee = price * commRateUsed;
        commSource = 'SKU Map';
      } else {
        commRateUsed = config.commissionRate;
        commissionFee = price * commRateUsed;
        commSource = 'Global Default';
      }

      // --- 服务费逻辑 ---
      let serviceFee = 0;
      let isServiceActual = false;
      if (order.rawServiceFee > 0) {
        serviceFee = order.rawServiceFee;
        isServiceActual = true;
      } else {
        serviceFee = price * config.serviceRate;
      }
      
      const processingFee = config.processingFeeFixed;
      const xtraFee = config.xtraEnabled ? (price * config.xtraRate) : 0;
      const feesTotal = commissionFee + serviceFee + processingFee + xtraFee;

      // --- 预计收入逻辑 ---
      let netIncomeIDR = 0;
      let isIncomeActual = false;
      if (isCancelled) {
        netIncomeIDR = 0;
      } else if (order.estimatedIncome && order.estimatedIncome > 0) {
        netIncomeIDR = order.estimatedIncome;
        isIncomeActual = true;
      } else {
        netIncomeIDR = price - feesTotal;
      }

      const netProfitRMB = isCancelled ? 0 : ((netIncomeIDR / config.exchangeRate) - (unitCostRMB * multiplier * order.quantity));

      return {
        ...order,
        costRMB: unitCostRMB * multiplier,
        commissionFee: isCancelled ? 0 : commissionFee,
        isCommissionActual,
        serviceFee: isCancelled ? 0 : serviceFee,
        isServiceActual,
        processingFee: isCancelled ? 0 : processingFee,
        xtraFee: isCancelled ? 0 : xtraFee,
        feesTotal: isCancelled ? 0 : feesTotal, 
        netIncomeIDR, 
        isIncomeActual,
        netProfitRMB,
        isMatchedCost: isMatched,
        commissionRateUsed: isCancelled ? 0 : commRateUsed,
        commissionSource: commSource
      } as CalculatedOrder;
    });
  }, [orders, costs, config]);

  const stats = useMemo(() => {
    const counts = { 
      [OrderStatus.COMPLETED]: 0, [OrderStatus.PAID]: 0, [OrderStatus.DELIVERED]: 0,
      [OrderStatus.CANCELLED]: 0, [OrderStatus.FAILED]: 0, [OrderStatus.IN_PROGRESS]: 0, [OrderStatus.UNKNOWN]: 0 
    };
    let totalSalesIDR = 0, totalFeesIDR = 0, totalIncomeIDR = 0, totalCostRMB = 0;
    const successfulStatuses = [OrderStatus.COMPLETED, OrderStatus.DELIVERED, OrderStatus.PAID];

    calculatedData.forEach(o => {
      counts[o.status]++;
      if (successfulStatuses.includes(o.status)) {
        totalSalesIDR += o.productPrice;
        totalFeesIDR += o.feesTotal;
        totalIncomeIDR += o.netIncomeIDR;
        if (o.isMatchedCost) totalCostRMB += (o.costRMB * o.quantity);
      }
    });
    
    const totalIncomeRMB = totalIncomeIDR / config.exchangeRate;
    const totalAdsRMB = totalAdsSpend / config.exchangeRate;
    const finalNetProfitRMB = totalIncomeRMB - totalCostRMB - totalAdsRMB;
    const margin = totalSalesIDR > 0 ? (finalNetProfitRMB / (totalSalesIDR / config.exchangeRate)) * 100 : 0;

    return { counts, totalSalesIDR, totalFeesIDR, totalIncomeIDR, totalIncomeRMB, totalCostRMB, totalAdsRMB, finalNetProfitRMB, margin, hasCosts: costs.length > 0 };
  }, [calculatedData, config.exchangeRate, totalAdsSpend, costs.length]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-sm">
      <aside className="w-80 bg-white border-r border-slate-200 p-6 flex flex-col gap-6 overflow-y-auto shadow-sm shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-orange-600 p-1.5 rounded-lg shadow-orange-200 shadow-lg">
            <LayoutDashboard className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 font-mono tracking-tighter">ID Station</h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Shopee Profit Calc</p>
          </div>
        </div>

        <section className="space-y-4">
          <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Upload size={14} /> 数据导入</h2>
          <div className="grid gap-3">
            <ImportButton icon={<FileSpreadsheet size={18}/>} title="导入订单表" sub="Shopee ID Export" color="hover:bg-orange-50 hover:border-orange-200" onChange={handleOrderUpload} />
            <ImportButton icon={<Megaphone size={18}/>} title="导入广告报表" sub="Ads Report XLS/CSV" color="hover:bg-blue-50 hover:border-blue-200" onChange={handleAdsUpload} />
            <ImportButton icon={<Database size={18}/>} title="导入成本库" sub="SKU Unit Cost RMB" color="hover:bg-emerald-50 hover:border-emerald-200" onChange={handleCostUpload} />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Settings size={14} /> 费率与参数</h2>
            <button onClick={learnCommissionRates} className="text-[10px] bg-orange-50 text-orange-600 px-2 py-1 rounded-md font-bold flex items-center gap-1 hover:bg-orange-100 transition-colors"><Zap size={10} /> 智能学习</button>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
            <ConfigInput label="汇率 (1 RMB = ? IDR)" value={config.exchangeRate} onChange={v => setConfig({...config, exchangeRate: v})} />
            <ConfigInput label="全局佣金率 (兜底)" value={config.commissionRate} step={0.001} onChange={v => setConfig({...config, commissionRate: v})} />
            <ConfigInput label="全局服务费率" value={config.serviceRate} step={0.001} onChange={v => setConfig({...config, serviceRate: v})} />
            <ConfigInput label="固定处理费 Fixed Fee" value={config.processingFeeFixed} onChange={v => setConfig({...config, processingFeeFixed: v})} />
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <div>
                <span className="text-xs font-semibold text-slate-700 block text-[11px]">Gratis Ongkir XTRA</span>
                <span className="text-[9px] text-slate-400">成交额额外扣除 5%</span>
              </div>
              <button onClick={() => setConfig({...config, xtraEnabled: !config.xtraEnabled})} className={`w-10 h-5 rounded-full transition-all relative ${config.xtraEnabled ? 'bg-orange-500' : 'bg-slate-300'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${config.xtraEnabled ? 'left-5.5' : 'left-0.5'}`} />
              </button>
            </div>
          </div>
        </section>
        <div className="mt-auto text-[10px] text-slate-400 text-center border-t pt-4">&copy; 2024 ShopeeProfit ID Station</div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="p-6 bg-white border-b border-slate-200 shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 shadow-sm">
              <div className="flex justify-between items-start mb-2"><span className="text-[10px] font-bold uppercase text-emerald-600">总到手 (有效成交单)</span><Wallet size={14} className="text-emerald-500" /></div>
              <div className="text-2xl font-black text-emerald-700">¥{stats.totalIncomeRMB.toFixed(2)}</div>
              <div className="text-[10px] font-medium text-emerald-600/70 truncate">Income / {config.exchangeRate} (不含 Batal)</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white shadow-xl shadow-slate-200">
              <div className="flex justify-between items-start opacity-70 mb-2"><span className="text-[10px] font-bold uppercase">总广告费支出</span><Megaphone size={14} /></div>
              <div className="text-xl font-bold">¥{stats.totalAdsRMB.toFixed(2)}</div>
              <div className="text-[10px] opacity-60">Rp {Math.round(totalAdsSpend).toLocaleString()}</div>
            </div>
            <div className={`rounded-2xl p-4 border shadow-sm ${stats.hasCosts ? 'bg-orange-500 text-white' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between items-start mb-2 opacity-80"><span className="text-[10px] font-bold uppercase">最终净利润 (RMB)</span><Coins size={14} /></div>
              {stats.hasCosts ? <div className="text-2xl font-black">¥{stats.finalNetProfitRMB.toFixed(2)}</div> : <div className="text-sm font-bold text-slate-400 mt-2 flex items-center gap-1 leading-tight"><AlertTriangle size={14} className="shrink-0" /> 缺少成本库</div>}
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start opacity-70 mb-2"><span className="text-[10px] font-bold uppercase text-slate-500">利润率</span><Percent size={14} className="text-slate-400" /></div>
              {stats.hasCosts ? <div className={`text-xl font-black ${stats.margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{stats.margin.toFixed(2)}%</div> : <div className="text-2xl font-black text-slate-200">—</div>}
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center">
               <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] font-bold uppercase text-slate-500">
                <div className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={10} /> <span>完成: {stats.counts[OrderStatus.COMPLETED] + stats.counts[OrderStatus.DELIVERED]}</span></div>
                <div className="flex items-center gap-1 text-red-400"><XCircle size={10} /> <span>取消: {stats.counts[OrderStatus.CANCELLED] + stats.counts[OrderStatus.FAILED]}</span></div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-200 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-slate-700 flex items-center gap-2"><TableIcon size={16} className="text-orange-500" /> 订单明细统计 ({calculatedData.length})</h3>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left min-w-[1200px] border-collapse">
                <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-200 z-10">
                  <tr>
                    <th className="px-6 py-4 w-16">操作</th>
                    <th className="px-4 py-4">订单号 & 状态</th>
                    <th className="px-4 py-4">SKU & 数量</th>
                    <th className="px-4 py-4">成交额</th>
                    <th className="px-4 py-4">预计收入 (IDR)</th>
                    <th className="px-4 py-4">成本 (RMB)</th>
                    <th className="px-4 py-4 text-right">净利润 (RMB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calculatedData.map((o, i) => {
                    const isCancelled = o.status === OrderStatus.CANCELLED || o.status === OrderStatus.FAILED;
                    const expandKey = `${o.orderId}-${o.sku}`;
                    const isExpanded = expandedOrders.has(expandKey);
                    return (
                      <React.Fragment key={expandKey}>
                        <tr className={`hover:bg-slate-50 transition-colors group ${isCancelled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                          <td className="px-6 py-4">
                            {!isCancelled && (
                              <button onClick={() => toggleExpand(o.orderId, o.sku)} className="flex items-center gap-1 text-[10px] font-bold text-orange-600 hover:text-orange-700">
                                {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} 明细
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-4"><div className="font-mono text-xs text-slate-500 mb-1">{o.orderId}</div><StatusBadge status={o.status} label={o.rawStatus} /></td>
                          <td className="px-4 py-4"><div className="font-bold text-slate-700 max-w-[180px] truncate mb-0.5">{o.sku || '未知 SKU'}</div><div className="text-[10px] text-slate-400 font-medium">数量: <span className="text-slate-600 font-bold">{o.quantity}</span></div></td>
                          <td className="px-4 py-4"><div className="text-slate-700 font-medium mb-1">Rp {Math.round(o.productPrice).toLocaleString()}</div></td>
                          <td className="px-4 py-4">
                            <div className={`${isCancelled ? 'text-slate-300' : 'text-emerald-600'} font-bold`}>Rp {Math.round(o.netIncomeIDR).toLocaleString()}</div>
                            <div className="text-[9px] text-slate-400">Estimated Order Income</div>
                          </td>
                          <td className="px-4 py-4">{o.isMatchedCost ? <div className="flex flex-col"><span className="text-slate-600 font-medium">¥{(o.costRMB * o.quantity).toFixed(2)}</span></div> : <span className="text-slate-300 italic text-[10px]">未匹配</span>}</td>
                          <td className="px-4 py-4 text-right">{isCancelled ? <div className="text-slate-200 font-black">¥0.00</div> : (stats.hasCosts && o.isMatchedCost ? <div className={`text-sm font-black ${o.netProfitRMB >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>¥{o.netProfitRMB.toFixed(2)}</div> : <div className="text-slate-300 font-black">—</div>)}</td>
                        </tr>
                        {isExpanded && !isCancelled && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={7} className="px-6 py-4 border-b border-slate-200">
                              <div className="grid grid-cols-4 gap-8 max-w-4xl">
                                <div>
                                  <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">订单金额详情</h4>
                                  <div className="space-y-1.5">
                                    <DetailRow label="商品价格 Subtotal" value={o.productPrice} />
                                    <DetailRow label="运费补贴 Subsidy" value={o.shippingSubsidy} isNeutral />
                                  </div>
                                </div>
                                <div>
                                  <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">平台费用扣除</h4>
                                  <div className="space-y-1.5">
                                    <DetailRow label="佣金 Commission" value={-o.commissionFee} isActual={o.isCommissionActual} />
                                    <DetailRow label="服务费 Service" value={-o.serviceFee} isActual={o.isServiceActual} />
                                    <DetailRow label="处理费 Processing" value={-o.processingFee} />
                                    {o.xtraFee > 0 && <DetailRow label="XTRA 费" value={-o.xtraFee} />}
                                  </div>
                                </div>
                                <div>
                                  <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">费用统计与到手</h4>
                                  <div className="space-y-1.5">
                                    <DetailRow label="总费用合计 Fees" value={-o.feesTotal} />
                                    <div className="pt-1 mt-1 border-t border-slate-200">
                                      <DetailRow label="预计到手 Income" value={o.netIncomeIDR} isBold isActual={o.isIncomeActual} />
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center justify-end">
                                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-right">
                                    <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">折合人民币到手</div>
                                    <div className="text-lg font-black text-emerald-600">¥{(o.netIncomeIDR / config.exchangeRate).toFixed(2)}</div>
                                    <div className="text-[9px] text-slate-400 font-medium italic">基于汇率: {config.exchangeRate}</div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value: number; isActual?: boolean; isNeutral?: boolean; isBold?: boolean }> = ({ label, value, isActual, isNeutral, isBold }) => (
  <div className={`flex justify-between items-center gap-2 text-[11px] ${isBold ? 'font-bold' : 'text-slate-600'}`}>
    <span className="flex items-center gap-1 shrink-0">{label} {isActual !== undefined && <span className={`px-1 py-0.5 rounded-[3px] text-[7px] font-black uppercase tracking-tighter ${isActual ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>{isActual ? 'Actual' : 'Est'}</span>}</span>
    <span className={isNeutral ? 'text-slate-400' : (value < 0 ? 'text-red-500' : (value > 0 ? 'text-emerald-600' : 'text-slate-300'))}>
      {value < 0 ? '-' : ''}Rp {Math.abs(Math.round(value)).toLocaleString()}
    </span>
  </div>
);

const ImportButton: React.FC<{ icon: any, title: string, sub: string, color: string, onChange: any }> = ({ icon, title, sub, color, onChange }) => (
  <label className={`flex items-center gap-4 p-4 border border-slate-200 rounded-2xl cursor-pointer transition-all bg-white group shadow-sm ${color}`}>
    <div className="text-slate-400 group-hover:scale-110 transition-transform shrink-0">{icon}</div>
    <div className="flex flex-col overflow-hidden"><span className="text-xs font-bold text-slate-700 truncate">{title}</span><span className="text-[10px] text-slate-400 uppercase tracking-tighter truncate">{sub}</span></div>
    <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={onChange} />
  </label>
);

const ConfigInput: React.FC<{ label: string, value: number, onChange: (v: number) => void, step?: number }> = ({ label, value, onChange, step = 1 }) => (
  <div>
    <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-tight">{label}</label>
    <input type="number" step={step} value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 font-medium text-slate-700" />
  </div>
);

const StatusBadge: React.FC<{ status: OrderStatus; label: string }> = ({ status, label }) => {
  const themes = {
    [OrderStatus.COMPLETED]: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    [OrderStatus.PAID]: 'bg-blue-50 text-blue-700 border-blue-100',
    [OrderStatus.DELIVERED]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    [OrderStatus.CANCELLED]: 'bg-red-50 text-red-700 border-red-100',
    [OrderStatus.FAILED]: 'bg-slate-100 text-slate-600 border-slate-200',
    [OrderStatus.IN_PROGRESS]: 'bg-slate-50 text-slate-500 border-slate-200',
    [OrderStatus.UNKNOWN]: 'bg-slate-50 text-slate-400 border-slate-100',
  };
  return <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border shrink-0 ${themes[status] || themes[OrderStatus.UNKNOWN]}`}>{label || status}</span>;
};

export default App;
