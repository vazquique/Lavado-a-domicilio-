"use client";

import { CalendarClock, Check, MessageCircle, NotebookPen, Phone, RotateCcw, UserX, Wallet, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_LABELS, type BookingStatus } from "@/lib/agenda";
import { idleState, type ActionState } from "@/lib/panel/action-state";
import type { AgendaBooking } from "@/lib/panel/agenda-data";
import { formatMXN } from "@/lib/money";
import { formatClockTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { changeBookingStatus, saveBookingNotes, setBalancePaid } from "./actions";
import { RescheduleForm } from "./reschedule-form";

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending_payment: "bg-amber-100 text-amber-800",
  confirmed: "bg-[color-mix(in_oklab,var(--brand)_15%,white)] text-[var(--brand)]",
  completed: "bg-green-100 text-green-800",
  no_show: "bg-orange-100 text-orange-800",
  cancelled: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
};

type Panel = "none" | "reschedule" | "cancel" | "notes";

// One booking in the agenda: who, where, what, how much is left to collect, and the
// buttons for the day (done, paid, no-show, move, cancel, WhatsApp reminder).
export function BookingCard({
  booking,
  today,
  onResult,
  onMoved,
}: {
  booking: AgendaBooking;
  today: string;
  onResult: (result: ActionState) => void;
  onMoved: (date: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [panel, setPanel] = useState<Panel>("none");

  function run(action: () => Promise<ActionState>) {
    startTransition(async () => {
      const result = await action();
      onResult(result);
      if (result.status === "success") setPanel("none");
    });
  }

  const { status } = booking;
  const owes = booking.balanceCents > 0 && !booking.balancePaid;
  const firstName = booking.customer.name.trim().split(/\s+/)[0];

  return (
    <article
      className={cn(
        "space-y-3 rounded-xl border bg-card p-3 shadow-sm",
        (status === "cancelled" || status === "expired") && "opacity-75",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          {booking.arrivalTime && (
            <span className="text-base font-bold tabular-nums">
              {formatClockTime(booking.arrivalTime)}
              {booking.untilTime && ` a ${formatClockTime(booking.untilTime)}`}
            </span>
          )}
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLES[status])}>
            {STATUS_LABELS[status]}
          </span>
        </span>
        <span className="text-right text-xs text-muted-foreground">
          {booking.folio} ·{" "}
          {booking.source === "manual"
            ? "La agregaste tú"
            : booking.paidOnlineCents > 0 || booking.status === "pending_payment"
              ? "En línea"
              : "En línea · efectivo"}
        </span>
      </div>

      <div className="space-y-0.5">
        <p className="font-semibold">{booking.customer.name}</p>
        <p className="text-sm">
          {booking.vehicleName}: {booking.services.join(", ")}
        </p>
        <p className="text-sm text-muted-foreground">
          {booking.address}
          {booking.zoneName ? `, ${booking.zoneName}` : ""}
        </p>
        {booking.references && <p className="text-sm text-muted-foreground">Referencias: {booking.references}</p>}
      </div>

      <p className="text-sm">
        Total {formatMXN(booking.totalCents)}
        {booking.paidOnlineCents > 0 && ` · Anticipo pagado ${formatMXN(booking.paidOnlineCents)}`}
        {" · "}
        {booking.balanceCents === 0 ? (
          "Pagado completo"
        ) : booking.balancePaid ? (
          <span className="text-green-700">Saldo pagado</span>
        ) : (
          <strong>Por cobrar {formatMXN(booking.balanceCents)}</strong>
        )}
      </p>

      {booking.notes && panel !== "notes" && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-line">{booking.notes}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {booking.reminderUrl && status !== "cancelled" && status !== "expired" && (
          <Button asChild size="sm" className="bg-green-600 text-white hover:bg-green-700">
            <a href={booking.reminderUrl} target="_blank" rel="noreferrer">
              <MessageCircle /> Recordatorio
            </a>
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <a href={`tel:+52${booking.customer.phone}`} aria-label={`Llamar a ${booking.customer.phoneLabel}`}>
            <Phone /> {booking.customer.phoneLabel}
          </a>
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPanel(panel === "notes" ? "none" : "notes")}>
          <NotebookPen /> Notas
        </Button>
      </div>

      {status === "confirmed" && panel === "none" && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => changeBookingStatus(booking.id, "completed"))}
            className="bg-[var(--brand)] text-[var(--brand-text)] hover:bg-[var(--brand)]/90"
          >
            <Check /> Terminado
          </Button>
          {owes && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setBalancePaid(booking.id, true))}>
              <Wallet /> Ya pagó
            </Button>
          )}
          {booking.balancePaid && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setBalancePaid(booking.id, false))}>
              <RotateCcw /> Deshacer pago
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setPanel("reschedule")}>
            <CalendarClock /> Reagendar
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => changeBookingStatus(booking.id, "no_show"))}
          >
            <UserX /> No llegó
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            className="col-span-2 text-destructive hover:text-destructive"
            onClick={() => setPanel("cancel")}
          >
            <X /> Cancelar reserva
          </Button>
        </div>
      )}

      {(status === "completed" || status === "no_show") && panel === "none" && (
        <div className="flex flex-wrap gap-2">
          {status === "completed" && owes && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setBalancePaid(booking.id, true))}>
              <Wallet /> Ya pagó
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => changeBookingStatus(booking.id, "confirmed"))}
          >
            <RotateCcw /> Deshacer
          </Button>
        </div>
      )}

      {panel === "cancel" && (
        <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p>
            ¿Cancelar la reserva de {firstName}? Su lugar queda libre y ya no se puede deshacer.
            {booking.paidOnlineCents > 0 && " Si le devuelves el anticipo, hazlo desde Mercado Pago."}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => run(() => changeBookingStatus(booking.id, "cancelled"))}
            >
              Sí, cancelar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPanel("none")}>
              No
            </Button>
          </div>
        </div>
      )}

      {panel === "reschedule" && (
        <RescheduleForm
          booking={booking}
          today={today}
          onDone={(result, date) => {
            onResult(result);
            setPanel("none");
            onMoved(date);
          }}
          onError={onResult}
          onClose={() => setPanel("none")}
        />
      )}

      {panel === "notes" && (
        <NotesEditor
          booking={booking}
          onSaved={(result) => {
            onResult(result);
            if (result.status === "success") setPanel("none");
          }}
          onClose={() => setPanel("none")}
        />
      )}
    </article>
  );
}

function NotesEditor({
  booking,
  onSaved,
  onClose,
}: {
  booking: AgendaBooking;
  onSaved: (result: ActionState) => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState(booking.notes);
  const [pending, startTransition] = useTransition();

  function save() {
    const formData = new FormData();
    formData.set("id", booking.id);
    formData.set("notes", notes);
    startTransition(async () => onSaved(await saveBookingNotes(idleState, formData)));
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        rows={3}
        maxLength={1000}
        aria-label="Notas de la reserva"
        placeholder="Ej. portón café, paga con transferencia, el perro muerde"
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={save}>
          {pending ? "Guardando…" : "Guardar notas"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}
