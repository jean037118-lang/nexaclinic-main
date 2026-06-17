'use client';

import type { FinancialSummary } from '@/lib/financial/types';
import { TrendingUp, TrendingDown, Wallet, AlertCircle } from 'lucide-react';

interface Props {
  summary: FinancialSummary;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function Card({ title, value, icon, color }: { title: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className={`rounded-lg p-2 ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export function FinancialSummaryCard({ summary }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card
        title="Total a Receber"
        value={formatCurrency(summary.totalReceivable)}
        icon={<TrendingUp className="h-6 w-6 text-green-600" />}
        color="bg-green-100"
      />
      <Card
        title="Total a Pagar"
        value={formatCurrency(summary.totalPayable)}
        icon={<TrendingDown className="h-6 w-6 text-red-600" />}
        color="bg-red-100"
      />
      <Card
        title="Saldo Geral"
        value={formatCurrency(summary.balance)}
        icon={<Wallet className="h-6 w-6 text-blue-600" />}
        color="bg-blue-100"
      />
      <Card
        title="Pendências"
        value={formatCurrency(summary.pendingReceivable + summary.pendingPayable)}
        icon={<AlertCircle className="h-6 w-6 text-yellow-600" />}
        color="bg-yellow-100"
      />
    </div>
  );
}
