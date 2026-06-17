/**
 * AccountForm.tsx — NexaClinic
 *
 * Formulário de conta a pagar/receber.
 * Quando a forma de pagamento é selecionada,
 * o destino financeiro é calculado automaticamente.
 * O usuário pode sobrescrever o destino se precisar.
 */

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { CreateAccountInput, UpdateAccountInput, Account, DestinoFinanceiro } from '@/lib/financial/types';
import { METODOS_PAGAMENTO, metodoParaDestinoDefault, DESTINO_LABELS, DESTINO_METODOS } from '@/lib/financial/types';

interface AccountFormProps {
  onSubmit:    (data: CreateAccountInput | UpdateAccountInput) => void;
  onCancel:    () => void;
  initialData?: Account;
  defaultType?: 'pagar' | 'receber';
}

export function AccountForm({ onSubmit, onCancel, initialData, defaultType = 'receber' }: AccountFormProps) {
  const isEditing = !!initialData;

  const [type,          setType]          = useState<'pagar' | 'receber'>(initialData?.type ?? defaultType);
  const [description,   setDescription]   = useState(initialData?.description ?? '');
  const [value,         setValue]         = useState(initialData?.value?.toString() ?? '');
  const [dueDate,       setDueDate]       = useState(initialData?.dueDate ?? new Date().toISOString().split('T')[0]);
  const [category,      setCategory]      = useState(initialData?.category ?? '');
  const [status,        setStatus]        = useState(initialData?.status ?? 'pendente');
  const [paymentMethod, setPaymentMethod] = useState(initialData?.paymentMethod ?? '');
  const [destino,       setDestino]       = useState<DestinoFinanceiro | ''>(initialData?.destino ?? '');
  const [notes,         setNotes]         = useState(initialData?.notes ?? '');
  const [errors,        setErrors]        = useState<Record<string, string>>({});

  // Atualiza destino automaticamente quando método muda
  useEffect(() => {
    if (paymentMethod) {
      setDestino(metodoParaDestinoDefault(paymentMethod));
    }
  }, [paymentMethod]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!description.trim()) errs.description = 'Descrição é obrigatória';
    const v = parseFloat(value.replace(',', '.'));
    if (!value || isNaN(v) || v <= 0) errs.value = 'Valor inválido';
    if (!dueDate) errs.dueDate = 'Data é obrigatória';
    if (!category.trim()) errs.category = 'Categoria é obrigatória';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    const data: CreateAccountInput = {
      type,
      description:   description.trim(),
      value:         parseFloat(value.replace(',', '.')),
      dueDate,
      category:      category.trim(),
      status:        status as any,
      paymentMethod: paymentMethod || undefined,
      destino:       (destino || undefined) as DestinoFinanceiro | undefined,
      origem:        initialData?.origem ?? 'manual',
      notes:         notes.trim() || undefined,
    };
    onSubmit(data);
  }

  const destinoOptions: DestinoFinanceiro[] = ['caixa_central', 'conta_bancaria', 'maquininha'];

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Atualize os dados da conta.' : 'Preencha os dados da nova conta.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo *</Label>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="receber">A Receber</SelectItem>
                  <SelectItem value="pagar">A Pagar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status *</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <Label className="text-xs">Descrição *</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Consulta João Silva"
            />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
          </div>

          {/* Valor + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Valor (R$) *</Label>
              <Input
                type="number" step="0.01" min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0,00"
              />
              {errors.value && <p className="text-xs text-red-500 mt-1">{errors.value}</p>}
            </div>
            <div>
              <Label className="text-xs">Data *</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              {errors.dueDate && <p className="text-xs text-red-500 mt-1">{errors.dueDate}</p>}
            </div>
          </div>

          {/* Categoria */}
          <div>
            <Label className="text-xs">Categoria *</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ex: Consulta, Exame, Despesa operacional..."
            />
            {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
          </div>

          {/* Forma de pagamento → destino automático */}
          {type === 'receber' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Forma de Pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {METODOS_PAGAMENTO.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">
                  Destino{' '}
                  <span className="text-muted-foreground font-normal">(auto)</span>
                </Label>
                <Select
                  value={destino}
                  onValueChange={(v) => setDestino(v as DestinoFinanceiro)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar destino..." />
                  </SelectTrigger>
                  <SelectContent>
                    {destinoOptions.map((d) => (
                      <SelectItem key={d} value={d}>{DESTINO_LABELS[d]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {destino && paymentMethod && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {paymentMethod} → {DESTINO_LABELS[destino as DestinoFinanceiro]}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Observações */}
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informações adicionais..."
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleSubmit}>
            {isEditing ? 'Salvar alterações' : 'Criar conta'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
