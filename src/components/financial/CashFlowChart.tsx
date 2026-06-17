'use client';

import type { CashFlow } from '@/lib/financial/types';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface Props {
  data: CashFlow[];
  onPeriodChange: (days: number) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function CashFlowChart({ data, onPeriodChange }: Props) {
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [period, setPeriod] = useState(30);

  const handlePeriodChange = (days: number) => {
    setPeriod(days);
    onPeriodChange(days);
  };

  const ChartComponent = chartType === 'bar' ? BarChart : LineChart;
  const DataComponent = chartType === 'bar' ? Bar : Line;

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Fluxo de Caixa</h2>
          <p className="text-sm text-muted-foreground">Últimos {period} dias</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={period === 7 ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePeriodChange(7)}
          >
            7 dias
          </Button>
          <Button
            variant={period === 30 ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePeriodChange(30)}
          >
            30 dias
          </Button>
          <Button
            variant={period === 90 ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePeriodChange(90)}
          >
            90 dias
          </Button>
          <Button
            variant={chartType === 'bar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setChartType('bar')}
          >
            Barras
          </Button>
          <Button
            variant={chartType === 'line' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setChartType('line')}
          >
            Linhas
          </Button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ChartComponent data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            labelFormatter={(label: string) => `Data: ${label}`}
          />
          <Legend />
          <DataComponent type="monotone" dataKey="inflow" stroke="#10b981" name="Entradas" />
          <DataComponent type="monotone" dataKey="outflow" stroke="#ef4444" name="Saídas" />
          <DataComponent type="monotone" dataKey="balance" stroke="#3b82f6" name="Saldo" />
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}
