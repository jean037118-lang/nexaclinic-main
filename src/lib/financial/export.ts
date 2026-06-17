import type { Account, MedicalCommission } from './types';

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

export function exportAccountsToCSV(accounts: Account[]): void {
  const rows = [
    ['Tipo', 'Descrição', 'Valor', 'Vencimento', 'Status', 'Categoria', 'Observações'],
    ...accounts.map(a => [
      a.type === 'receber' ? 'A Receber' : 'A Pagar',
      a.description,
      a.value.toFixed(2).replace('.', ','),
      formatDate(a.dueDate),
      a.status,
      a.category,
      a.notes || '',
    ]),
  ];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `contas-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportCommissionsToCSV(commissions: MedicalCommission[]): void {
  const rows = [
    ['Médico', 'Valor', 'Percentual', 'Mês', 'Status'],
    ...commissions.map(c => [
      c.doctorName,
      c.value.toFixed(2).replace('.', ','),
      c.percentage ? `${c.percentage}%` : '',
      c.month,
      c.status,
    ]),
  ];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `comissoes-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
