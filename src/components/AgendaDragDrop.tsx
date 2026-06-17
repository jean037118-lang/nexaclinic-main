import { useEffect, useState } from "react"

import {
  DndContext,
  closestCenter,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core"

interface Appointment {
  id: string
  patient: string
  time: string

  status:
    | "confirmado"
    | "aguardando"
    | "cancelado"
    | "finalizado"
}
const statusColors = {
  confirmado:
    "bg-green-500 border-green-600",

  aguardando:
    "bg-yellow-500 border-yellow-600",

  cancelado:
    "bg-red-500 border-red-600",

  finalizado:
    "bg-gray-500 border-gray-600",
}

const hours = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
]

function DraggableAppointment({
  appointment,
  setSelectedAppointment,
  setOpenModal,
}: {
  appointment: Appointment

  setSelectedAppointment:
    (appointment: Appointment) => void

  setOpenModal:
    (open: boolean) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useDraggable({
    id: appointment.id,
  })

  const style = transform
    ? {
        transform: `translate3d(
          ${transform.x}px,
          ${transform.y}px,
          0
        )`,
      }
    : undefined

  return (
   <div
  ref={setNodeRef}
  style={style}
  {...listeners}
  {...attributes}

  onClick={() => {
    setSelectedAppointment(
      appointment
    )

    setOpenModal(true)
  }}
      style={style}
      {...listeners}
      {...attributes}
      className={`
  ${
    statusColors[
      appointment.status
    ]
  }

  text-white
  rounded-lg
  p-3
  cursor-grab
  shadow
  border
`}
    >
      <div className="font-semibold">
        {appointment.patient}
      </div>

      <div className="text-sm opacity-90">
        {appointment.time}
      </div>
    </div>
  )
}

function DroppableHour({
  hour,
  children,
}: {
  hour: string
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: hour,
  })

  return (
    <div
      ref={setNodeRef}
      className={`
        min-h-[80px]
        transition
        ${
          isOver
            ? "bg-cyan-50"
            : ""
        }
      `}
    >
      {/* Linha de horário estilo Google Calendar */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm font-bold text-gray-700 w-12 shrink-0 tabular-nums">
          {hour}
        </span>
        <div className="flex-1 border-t-2 border-gray-300" />
      </div>

      {/* Área de conteúdo com fundo levemente cinza */}
      <div
        className={`
          rounded-lg
          px-3
          py-2
          min-h-[52px]
          transition
          ${
            isOver
              ? "bg-cyan-100 ring-2 ring-cyan-400"
              : "bg-gray-50"
          }
        `}
      >
        {children}
      </div>
    </div>
  )
}

export function AgendaDragDrop() {
  const [appointments, setAppointments] =
    useState<Appointment[]>([])

const [selectedAppointment,
  setSelectedAppointment] =
  useState<Appointment | null>(null)

const [openModal, setOpenModal] =
  useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(
      "appointments"
    )

    if (saved) {
      setAppointments(JSON.parse(saved))
    } else {
      const fakeData = [
        {
          id: crypto.randomUUID(),
            patient: "João Silva",
            time: "09:00",
            status: "confirmado",
        },

        {
          id: crypto.randomUUID(),
             patient: "Maria Souza",
             time: "11:00",
             status: "aguardando",
        },
      ]

      setAppointments(fakeData)

      localStorage.setItem(
        "appointments",
        JSON.stringify(fakeData)
      )
    }
  }, [])

  function handleDragEnd(event: any) {
  const { active, over } = event

  if (!over) return

  const appointmentId = active.id
  const newTime = over.id

  const currentAppointment =
    appointments.find(
      (a) => a.id === appointmentId
    )

  if (!currentAppointment) return
function updateStatus(
  id: string,
  status: Appointment["status"]
) {
  const updated =
    appointments.map((appt) =>
      appt.id === id
        ? { ...appt, status }
        : appt
    )

  setAppointments(updated)

  localStorage.setItem(
    "appointments",
    JSON.stringify(updated)
  )

  setOpenModal(false)
}

  // Verifica conflito
  const conflictingAppointment =
    appointments.find(
      (a) =>
        a.time === newTime &&
        a.id !== appointmentId
    )

  // Impede horário duplicado
  if (conflictingAppointment) {
    alert(
      `Horário ${newTime} já ocupado por ${conflictingAppointment.patient}`
    )

    return
  }

  // Atualiza consulta
  const updatedAppointments =
    appointments.map((appt) =>
      appt.id === appointmentId
        ? {
            ...appt,
            time: newTime,
          }
        : appt
    )

  setAppointments(updatedAppointments)

  localStorage.setItem(
    "appointments",
    JSON.stringify(updatedAppointments)
  )
}

    const updatedAppointments =
      appointments.map((appt) =>
        appt.id === appointmentId
          ? {
              ...appt,
              time: newTime,
            }
          : appt
      )

    setAppointments(updatedAppointments)

    localStorage.setItem(
      "appointments",
      JSON.stringify(updatedAppointments)
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">
        Agenda Drag & Drop
      </h1>

      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col gap-1">
          {hours.map((hour) => {
            const appointment =
              appointments.find(
                (a) => a.time === hour
              )

            return (
              <DroppableHour
                key={hour}
                hour={hour}
              >
                {appointment && (
                  <DraggableAppointment
  appointment={appointment}
  setSelectedAppointment={
    setSelectedAppointment
  }
  setOpenModal={setOpenModal}
/>
                )}
              </DroppableHour>
            )
          })}
        </div>
      </DndContext>
{
  openModal &&
    selectedAppointment && (
      <div
        className="
          fixed
          inset-0
          bg-black/50
          flex
          items-center
          justify-center
          z-50
        "
      >
        <div
          className="
            bg-white
            rounded-2xl
            p-6
            w-[400px]
          "
        >
          <h2
            className="
              text-2xl
              font-bold
              mb-4
            "
          >
            Consulta
          </h2>

          <p>
            Paciente:
            {" "}
            {
              selectedAppointment.patient
            }
          </p>

          <p>
            Horário:
            {" "}
            {
              selectedAppointment.time
            }
          </p>

          <div className="grid gap-3 mt-6">
            <button
              onClick={() =>
                updateStatus(
                  selectedAppointment.id,
                  "confirmado"
                )
              }
              className="
                bg-green-600
                text-white
                py-2
                rounded-lg
              "
            >
              Confirmar
            </button>

            <button
              onClick={() =>
                updateStatus(
                  selectedAppointment.id,
                  "cancelado"
                )
              }
              className="
                bg-red-600
                text-white
                py-2
                rounded-lg
              "
            >
              Cancelar
            </button>

            <button
              onClick={() =>
                updateStatus(
                  selectedAppointment.id,
                  "finalizado"
                )
              }
              className="
                bg-gray-600
                text-white
                py-2
                rounded-lg
              "
            >
              Finalizar
            </button>

            <button
              onClick={() =>
                setOpenModal(false)
              }
              className="
                bg-slate-300
                py-2
                rounded-lg
              "
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    )
}
    </div>
  )
}