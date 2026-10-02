create policy "Usuario pre-reserva turno disponible"
on public.disponibilidad_turnos
for update
to authenticated
using (estado = 'disponible')
with check (estado = 'pre_reservado');
