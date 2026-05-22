import React, { useEffect, useMemo, useState } from 'react';

type FoodItem = {
  id: string;
  name: string;
  weight: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  createdAt: string;
};

const STORAGE_KEY = 'daily-calorie-calculator-items';

const App: React.FC = () => {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [form, setForm] = useState({
    name: '',
    weight: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as FoodItem[];
      if (Array.isArray(parsed)) {
        setItems(parsed);
      }
    } catch {
      // ignore broken data
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.calories += item.calories;
        acc.protein += item.protein;
        acc.carbs += item.carbs;
        acc.fat += item.fat;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [items]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      alert('请输入食物名称');
      return;
    }

    const next: FoodItem = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      weight: Number(form.weight) || 0,
      calories: Number(form.calories) || 0,
      protein: Number(form.protein) || 0,
      carbs: Number(form.carbs) || 0,
      fat: Number(form.fat) || 0,
      createdAt: new Date().toISOString(),
    };

    setItems((prev) => [next, ...prev]);
    setForm({ name: '', weight: '', calories: '', protein: '', carbs: '', fat: '' });
  };

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearAll = () => {
    if (window.confirm('确定要清空今天记录吗？')) {
      setItems([]);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900">
      <div className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <header className="mb-4">
          <h1 className="text-2xl font-bold">每日热量计算器</h1>
          <p className="mt-1 text-sm text-slate-500">记录食物并自动统计今日总热量与三大营养素</p>
        </header>

        <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-orange-50 p-3">
            <p className="text-xs text-slate-500">今日总热量</p>
            <p className="text-lg font-semibold text-orange-600">{totals.calories.toFixed(0)} kcal</p>
          </div>
          <div className="rounded-xl bg-blue-50 p-3">
            <p className="text-xs text-slate-500">蛋白质</p>
            <p className="text-lg font-semibold text-blue-600">{totals.protein.toFixed(1)} g</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-xs text-slate-500">碳水</p>
            <p className="text-lg font-semibold text-emerald-600">{totals.carbs.toFixed(1)} g</p>
          </div>
          <div className="rounded-xl bg-pink-50 p-3">
            <p className="text-xs text-slate-500">脂肪</p>
            <p className="text-lg font-semibold text-pink-600">{totals.fat.toFixed(1)} g</p>
          </div>
        </section>

        <form onSubmit={handleAdd} className="mb-5 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">食物名称</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="例如：鸡胸肉"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-orange-500 focus:ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">重量 (g)</label>
              <input value={form.weight} onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))} type="number" min="0" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-orange-500 focus:ring" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">热量 (kcal)</label>
              <input value={form.calories} onChange={(e) => setForm((f) => ({ ...f, calories: e.target.value }))} type="number" min="0" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-orange-500 focus:ring" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">蛋白质 (g)</label>
              <input value={form.protein} onChange={(e) => setForm((f) => ({ ...f, protein: e.target.value }))} type="number" min="0" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-orange-500 focus:ring" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">碳水 (g)</label>
              <input value={form.carbs} onChange={(e) => setForm((f) => ({ ...f, carbs: e.target.value }))} type="number" min="0" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-orange-500 focus:ring" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">脂肪 (g)</label>
              <input value={form.fat} onChange={(e) => setForm((f) => ({ ...f, fat: e.target.value }))} type="number" min="0" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-orange-500 focus:ring" />
            </div>
          </div>

          <button type="submit" className="w-full rounded-xl bg-orange-500 px-4 py-2 font-medium text-white hover:bg-orange-600">
            添加记录
          </button>
        </form>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">今日记录</h2>
            <button onClick={clearAll} className="text-sm text-slate-500 hover:text-red-500" type="button">清空</button>
          </div>

          {items.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">还没有记录，先添加一条吧。</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.weight}g · {item.calories} kcal</p>
                      <p className="mt-1 text-xs text-slate-500">蛋白质 {item.protein}g / 碳水 {item.carbs}g / 脂肪 {item.fat}g</p>
                    </div>
                    <button type="button" className="text-xs text-slate-400 hover:text-red-500" onClick={() => handleDelete(item.id)}>
                      删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
};

export default App;
