import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CreateCommissionInput, UpdateCommissionInput, MedicalCommission } from '@/lib/financial/types';

interface CommissionFormProps {
  onSubmit: (data: CreateCommissionInput | UpdateCommissionInput) => void;
  isLoading?: boolean;
  initialData?: MedicalCommission;
  isEditing?: boolean;
  doctors?: Array<{ id: string; name: string }>;
}

export function CommissionForm({
  onSubmit,
  isLoading = false,
  initialData,
  isEditing = false,
  doctors = [],
}: CommissionFormProps) {
  const [formData, setFormData] = useState<CreateCommissionInput | UpdateCommissionInput>(
    initialData
      ? {
          value: initialData.value,
          ...(isEditing && { status: initialData.status }),
        }
      : {
          doctorId: '',
          doctorName: '',
          month: new Date().toISOString().slice(0, 7),
          value: 0,
          percentage: 0,
          consultations: 0,
        }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <Card className="p-6">
      <h3 className="mb-4 text-lg font-semibold">{isEditing ? 'Editar Comissão' : 'Nova Comissão'}</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEditing && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Médico</label>
              {doctors.length > 0 ? (
                <Select
                  value={(formData as CreateCommissionInput).doctorId}
                  onValueChange={(value) => {
                    const doctor = doctors.find((d) => d.id === value);
                    if (doctor) {
                      handleChange('doctorId', value);
                      handleChange('doctorName', doctor.name);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um médico" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type="text"
                  value={(formData as CreateCommissionInput).doctorName}
                  onChange={(e) => handleChange('doctorName', e.target.value)}
                  placeholder="Nome do médico"
                  required
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mês</label>
              <Input
                type="month"
                value={(formData as CreateCommissionInput).month}
                onChange={(e) => handleChange('month', e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Percentual (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={(formData as CreateCommissionInput).percentage}
                  onChange={(e) => handleChange('percentage', parseFloat(e.target.value))}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Consultas</label>
                <Input
                  type="number"
                  value={(formData as CreateCommissionInput).consultations}
                  onChange={(e) => handleChange('consultations', parseInt(e.target.value))}
                  placeholder="0"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Valor Base (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={(formData as CreateCommissionInput).value}
                  onChange={(e) => handleChange('value', parseFloat(e.target.value))}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
          </>
        )}

        {isEditing && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Valor (R$)</label>
              <Input
                type="number"
                step="0.01"
                value={(formData as UpdateCommissionInput).value}
                onChange={(e) => handleChange('value', parseFloat(e.target.value))}
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <Select
                value={(formData as UpdateCommissionInput).status}
                onValueChange={(value) => handleChange('status', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="processando">Processando</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar Comissão'}
        </Button>
      </form>
    </Card>
  );
}
