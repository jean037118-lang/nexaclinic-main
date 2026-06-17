import { useState } from 'react'
import { useSpecialty } from '@/store/useSpecialty'
import { specialtyStore } from '@/store/useSpecialty'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, Trash2, Check, X, Plus, Stethoscope } from 'lucide-react'
import { toast } from 'sonner'

export function EspecialidadeForm() {
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const { specialties, addSpecialty } = useSpecialty()

  function handleAdd() {
    const trimmed = name.trim()
    if (!trimmed) return
    const dup = specialties.find(s => s.name.toLowerCase() === trimmed.toLowerCase())
    if (dup) { toast.error('Especialidade já cadastrada.'); return }
    addSpecialty({ id: crypto.randomUUID(), name: trimmed })
    setName('')
    toast.success(`Especialidade "${trimmed}" criada.`)
  }

  function handleEdit(id: string) {
    const trimmed = editingName.trim()
    if (!trimmed) { toast.error('Informe o nome'); return }
    const dup = specialties.find(s => s.name.toLowerCase() === trimmed.toLowerCase() && s.id !== id)
    if (dup) { toast.error('Já existe uma especialidade com esse nome.'); return }
    const updated = specialties.map(s => s.id === id ? { ...s, name: trimmed } : s)
    localStorage.setItem('nexaclinic_specialties_store', JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent('nexaclinic:specialties-changed'))
    setEditingId(null)
    toast.success('Especialidade atualizada.')
  }

  function handleDelete(id: string, nome: string) {
    specialtyStore.remove(id)
    toast.success(`Especialidade "${nome}" removida.`)
  }

  return (
    <div className="space-y-6 p-6 max-w-xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Especialidades</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Especialidades disponíveis para seleção no cadastro de profissionais.
        </p>
      </div>

      {/* Formulário de criação */}
      <div className="flex gap-2">
        <Input
          placeholder="Nome da especialidade (ex: Cardiologia)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          className="flex-1"
        />
        <Button onClick={handleAdd} className="gap-1.5 bg-gradient-to-r from-cyan-600 to-teal-600 text-white hover:from-cyan-700 hover:to-teal-700 shadow-sm">
          <Plus className="h-4 w-4" /> Criar
        </Button>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {specialties.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center text-muted-foreground">
            <Stethoscope className="h-10 w-10 opacity-20" />
            <p className="text-sm">Nenhuma especialidade cadastrada.</p>
            <p className="text-xs">Crie a primeira especialidade acima.</p>
          </div>
        ) : (
          specialties.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm"
            >
              <Stethoscope className="h-4 w-4 text-primary/60 shrink-0" />

              {editingId === s.id ? (
                <>
                  <Input
                    className="h-7 flex-1 text-sm"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleEdit(s.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:bg-green-50" onClick={() => handleEdit(s.id)}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium">{s.name}</span>
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary"
                    onClick={() => { setEditingId(s.id); setEditingName(s.name) }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(s.id, s.name)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {specialties.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {specialties.length} especialidade{specialties.length !== 1 ? 's' : ''} cadastrada{specialties.length !== 1 ? 's' : ''}.
          As alterações refletem imediatamente no cadastro de profissionais.
        </p>
      )}
    </div>
  )
}
