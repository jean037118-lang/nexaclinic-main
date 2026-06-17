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
import type { MedicalCommission } from '@/lib/financial/types';

interface CommissionsTableProps {
  commissions: MedicalCommission[];
  onEdit: (commission: MedicalCommission) => void;
  onDelete: (id: string) => void;
  onPayAll?: () => void;
  isLoading?: boolean;
}

export function CommissionsTable({
  commissions,
  onEdit,
  onDelete,
  onPayAll,
  isLoading = false,
}: CommissionsTableProps) {
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pendente: 'bg-yellow-100 text-yellow-800',
      pago: 'bg-green-100 text-green-800',
      processando: 'bg-blue-100 text-blue-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const pendingCommissions = commissions.filter((c) => c.status !== 'pago');
  const totalPending = pendingCommissions.reduce((sum, c) => sum + c.value, 0);

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando comissões...</p>
          </div>
        </div>
      </Card>
    );
  }

  if (commissions.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600">Nenhuma comissão registrada</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      {pendingCommissions.length > 0 && (
        <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-800">
                {pendingCommissions.length} comissão(ões) pendente(s)
              </p>
              <p className="text-lg font-semibold text-yellow-900 mt-1">{formatCurrency(totalPending)}</p>
            </div>
            {onPayAll && (
              <Button variant="default" onClick={onPayAll}>
                Pagar Todas
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Médico</TableHead>
              <TableHead>Mês</TableHead>
              <TableHead>Consultas</TableHead>
              <TableHead>Percentual</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data Criação</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {commissions.map((commission) => (
              <TableRow key={commission.id}>
                <TableCell className="font-medium">{commission.doctorName}</TableCell>
                <TableCell>{commission.month}</TableCell>
                <TableCell>{commission.consultations}</TableCell>
                <TableCell>{commission.percentage}%</TableCell>
                <TableCell className="font-semibold">{formatCurrency(commission.value)}</TableCell>
                <TableCell>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(commission.status)}`}>
                    {commission.status.charAt(0).toUpperCase() + commission.status.slice(1)}
                  </span>
                </TableCell>
                <TableCell>{formatDate(commission.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(commission)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onDelete(commission.id)}
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
        Total de comissões: {commissions.length}
      </div>
    </Card>
  );
}
