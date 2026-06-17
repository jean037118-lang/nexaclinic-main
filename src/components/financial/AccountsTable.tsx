import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/financial/export';
import type { Account } from '@/lib/financial/types';

interface AccountsTableProps {
  accounts: Account[];
  onEdit: (account: Account) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

export function AccountsTable({ accounts, onEdit, onDelete, isLoading = false }: AccountsTableProps) {
  const [filter, setFilter] = useState<'todos' | 'receber' | 'pagar'>('todos');

  const filteredAccounts = accounts.filter((account) => {
    if (filter === 'todos') return true;
    return account.type === filter;
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pendente: 'bg-yellow-100 text-yellow-800',
      pago: 'bg-green-100 text-green-800',
      vencido: 'bg-red-100 text-red-800',
      cancelado: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-blue-100 text-blue-800';
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando contas...</p>
          </div>
        </div>
      </Card>
    );
  }

  if (filteredAccounts.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600">Nenhuma conta encontrada</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex gap-2">
        <Button
          variant={filter === 'todos' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('todos')}
        >
          Todas
        </Button>
        <Button
          variant={filter === 'receber' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('receber')}
        >
          A Receber
        </Button>
        <Button
          variant={filter === 'pagar' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('pagar')}
        >
          A Pagar
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAccounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="font-medium">{account.description}</TableCell>
                <TableCell>{account.type === 'receber' ? '📥 Receber' : '📤 Pagar'}</TableCell>
                <TableCell className="font-semibold">{formatCurrency(account.value)}</TableCell>
                <TableCell>{formatDate(account.dueDate)}</TableCell>
                <TableCell>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(account.status)}`}>
                    {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
                  </span>
                </TableCell>
                <TableCell>{account.category}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(account)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onDelete(account.id)}
                    >
                      Deletar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        Total de contas: {filteredAccounts.length}
      </div>
    </Card>
  );
}
