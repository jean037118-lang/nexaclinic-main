import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSpecialty } from '@/hooks/useSpecialty';
import { Plus, Trash2, Edit2 } from 'lucide-react';

export function SpecialtyForm() {
  const { specialties, createSpecialty, updateSpecialty, deleteSpecialty } = useSpecialty();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      const response = updateSpecialty(editingId, { name });
      if (response.success) {
        setMessage({ type: 'success', text: 'Especialidade atualizada com sucesso!' });
        setEditingId(null);
      } else {
        setMessage({ type: 'error', text: response.error || 'Erro ao atualizar' });
      }
    } else {
      const response = createSpecialty({ name });
      if (response.success) {
        setMessage({ type: 'success', text: 'Especialidade criada com sucesso!' });
      } else {
        setMessage({ type: 'error', text: response.error || 'Erro ao criar' });
      }
    }

    setName('');
    setTimeout(() => setMessage(null), 3000);
  };

  const handleEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setName(currentName);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja deletar esta especialidade?')) {
      const response = deleteSpecialty(id);
      if (response.success) {
        setMessage({ type: 'success', text: 'Especialidade deletada com sucesso!' });
      } else {
        setMessage({ type: 'error', text: response.error || 'Erro ao deletar' });
      }
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setName('');
  };

  return (
    <div className="space-y-6">
      {/* Formulário */}
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold">
          {editingId ? 'Editar Especialidade' : 'Cadastrar Especialidade'}
        </h2>

        {message && (
          <div
            className={`rounded-md p-3 text-sm ${
              message.type === 'success'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da especialidade (ex: Cardiologia)"
            className="flex-1"
          />
          <Button type="submit" className="gap-2">
            <Plus className="h-4 w-4" />
            {editingId ? 'Atualizar' : 'Criar'}
          </Button>
          {editingId && (
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
          )}
        </div>
      </form>

      {/* Lista */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">
          Especialidades ({specialties.length})
        </h3>

        {specialties.length === 0 ? (
          <p className="text-center text-muted-foreground">Nenhuma especialidade cadastrada</p>
        ) : (
          <div className="space-y-2">
            {specialties.map((specialty) => (
              <div
                key={specialty.id}
                className="flex items-center justify-between rounded-lg border bg-background p-3"
              >
                <div>
                  <p className="font-medium">{specialty.name}</p>
                  <p className="text-xs text-muted-foreground">
                    ID: {specialty.id}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(specialty.id, specialty.name)}
                    className="gap-2"
                  >
                    <Edit2 className="h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(specialty.id)}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Deletar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
